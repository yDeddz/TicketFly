import { appUrl } from "@/lib/env";
import {
  AsaasRequestError,
  asaasCreatePayment,
  asaasDueDate,
  asaasFindOrCreateCustomer,
  asaasFindPaymentByExternalReference,
  asaasGetPixQrCode,
  type AsaasPixQrCode,
} from "@/lib/payments/asaas-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { signDoorPaymentAccessToken } from "@/lib/ticket-crypto";

export type DoorPaymentMethod = "pix" | "credit_card";

export type DoorSaleInput = {
  organizerId: string;
  asaasWalletId: string;
  operatorUserId: string;
  batchId: string;
  buyerName: string;
  buyerEmail: string;
  buyerCpf: string;
  buyerPhone: string;
  paymentMethod: DoorPaymentMethod;
  idempotencyKey: string;
};

type DoorSaleReservation = {
  payment_id: string;
  ticket_id: string;
  ticket_code: string;
  event_id: string;
  event_title: string;
  batch_name: string;
  ticket_price_cents: number;
  fee_cents: number;
  platform_share_cents: number;
  partner_share_cents: number;
  amount_cents: number;
  net_amount_cents: number;
  existing: boolean;
};

export class DoorSaleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DoorSaleError";
  }
}

function rpcError(message?: string) {
  if (!message) return new DoorSaleError("Não foi possível reservar o ingresso", 500, "DOOR_SALE_FAILED");
  if (message.includes("ticket_batch_sold_out")) {
    return new DoorSaleError("Este lote esgotou", 409, "BATCH_SOLD_OUT");
  }
  if (message.includes("ticket_batch_closed")) {
    return new DoorSaleError("Este lote não está aberto para vendas", 409, "BATCH_CLOSED");
  }
  if (message.includes("event_not_owned")) {
    return new DoorSaleError("Evento não pertence a este organizador", 403, "EVENT_NOT_OWNED");
  }
  if (message.includes("event_not_published")) {
    return new DoorSaleError("Evento não está publicado", 409, "EVENT_NOT_PUBLISHED");
  }
  if (message.includes("idempotency_conflict")) {
    return new DoorSaleError("Esta tentativa já foi usada com outros dados", 409, "IDEMPOTENCY_CONFLICT");
  }
  if (message.includes("organizer_not_approved")) {
    return new DoorSaleError("Organizador ainda não está aprovado", 409, "ORGANIZER_NOT_APPROVED");
  }
  return new DoorSaleError("Não foi possível criar a venda", 500, "DOOR_SALE_FAILED");
}

async function compensateRejectedProviderRequest(paymentId: string, reason: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_payment_status", {
    p_payment_id: paymentId,
    p_status: "cancelled",
    p_provider_payment_id: null,
    p_payload: {
      source: "door_sale",
      provider_state: "rejected_before_creation",
      reason: reason.slice(0, 500),
    },
  });
  if (error) {
    throw new DoorSaleError(
      "O Asaas recusou os dados e a reserva não pôde ser liberada. Tente de novo.",
      503,
      "DOOR_SALE_COMPENSATE_FAILED",
    );
  }
}

export async function createOrResumeDoorSale(input: DoorSaleInput) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("create_door_sale", {
      p_organizer_id: input.organizerId,
      p_batch_id: input.batchId,
      p_buyer_name: input.buyerName,
      p_buyer_email: input.buyerEmail,
      p_buyer_phone: input.buyerPhone,
      p_payment_method: input.paymentMethod,
      p_created_by: input.operatorUserId,
      p_idempotency_key: input.idempotencyKey,
    })
    .single();

  if (error || !data) throw rpcError(error?.message);
  const reservation = data as DoorSaleReservation;

  const accessToken = await signDoorPaymentAccessToken({
    paymentId: reservation.payment_id,
  });
  const buyerUrl = `${appUrl()}/pagar/${encodeURIComponent(accessToken)}`;

  const { data: localPayment } = await admin
    .from("payments")
    .select("status,provider_payment_id,checkout_url,payment_method")
    .eq("id", reservation.payment_id)
    .single();

  if (!localPayment) {
    throw new DoorSaleError("Pagamento local não encontrado", 500, "PAYMENT_NOT_FOUND");
  }

  if (localPayment.status !== "pending") {
    return {
      ...reservation,
      status: localPayment.status,
      buyerUrl,
      checkoutUrl: localPayment.checkout_url,
      pix: null as AsaasPixQrCode | null,
    };
  }

  let providerPaymentId = localPayment.provider_payment_id;
  let checkoutUrl = localPayment.checkout_url;

  try {
    if (!providerPaymentId) {
      const recovered = await asaasFindPaymentByExternalReference(reservation.payment_id);
      if (recovered?.id) {
        providerPaymentId = recovered.id;
        checkoutUrl = recovered.invoiceUrl ?? checkoutUrl;
      }
    }

    if (!providerPaymentId) {
      const customer = await asaasFindOrCreateCustomer({
        name: input.buyerName,
        email: input.buyerEmail,
        cpfCnpj: input.buyerCpf,
        mobilePhone: input.buyerPhone,
      });

      const payment = await asaasCreatePayment({
        customer: customer.id,
        billingType: input.paymentMethod === "pix" ? "PIX" : "CREDIT_CARD",
        value: Number((reservation.amount_cents / 100).toFixed(2)),
        dueDate: asaasDueDate(1),
        description: `${reservation.event_title} · ${reservation.batch_name}`.slice(0, 500),
        externalReference: reservation.payment_id,
        callback: {
          successUrl: buyerUrl,
          autoRedirect: true,
        },
        split: [
          {
            walletId: input.asaasWalletId,
            fixedValue: Number((reservation.net_amount_cents / 100).toFixed(2)),
            description: "Repasse organizador Ticket Fly",
            externalReference: reservation.payment_id,
          },
        ],
      });

      providerPaymentId = payment.id;
      checkoutUrl = payment.invoiceUrl ?? null;
    }

    await admin
      .from("payments")
      .update({
        provider: "asaas",
        provider_preference_id: providerPaymentId,
        provider_payment_id: providerPaymentId,
        checkout_url: checkoutUrl,
        raw_payload: {
          source: "door_sale",
          provider_state: "created",
          payment_method: input.paymentMethod,
        },
      })
      .eq("id", reservation.payment_id)
      .eq("status", "pending");

    if (!checkoutUrl) {
      throw new DoorSaleError("Asaas não retornou o link de pagamento", 502, "ASAAS_LINK_MISSING");
    }

    const pix =
      input.paymentMethod === "pix"
        ? await asaasGetPixQrCode(providerPaymentId)
        : null;

    return {
      ...reservation,
      status: "pending",
      buyerUrl,
      checkoutUrl,
      pix,
    };
  } catch (cause) {
    if (cause instanceof DoorSaleError) throw cause;

    if (cause instanceof AsaasRequestError && cause.status >= 400 && cause.status < 500) {
      if (!providerPaymentId) {
        await compensateRejectedProviderRequest(reservation.payment_id, cause.message);
        throw new DoorSaleError(
          "O Asaas recusou os dados da cobrança. Confira CPF, celular e conexão da conta.",
          422,
          "ASAAS_REJECTED",
        );
      }
    }

    throw new DoorSaleError(
      "O Asaas demorou para responder. Tente novamente com a mesma venda.",
      503,
      "ASAAS_TEMPORARY_FAILURE",
    );
  }
}

