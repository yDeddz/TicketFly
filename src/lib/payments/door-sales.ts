import { appUrl } from "@/lib/env";
import {
  pagarmeCreateCheckout,
  PagarmeRequestError,
} from "@/lib/payments/pagarme-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { signDoorPaymentAccessToken } from "@/lib/ticket-crypto";

export type DoorPaymentMethod = "pix" | "credit_card";

export type DoorSaleInput = {
  organizerId: string;
  pagarmeRecipientId: string;
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
      "A Pagar.me recusou os dados e a reserva não pôde ser liberada. Tente de novo.",
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
    .select("status,provider_preference_id,provider_payment_id,checkout_url,payment_method")
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
      pix: null,
    };
  }

  let providerPreferenceId = localPayment.provider_preference_id;
  let providerPaymentId = localPayment.provider_payment_id;
  let checkoutUrl = localPayment.checkout_url;

  try {
    if (!providerPreferenceId || !checkoutUrl) {
      const checkout = await pagarmeCreateCheckout({
        paymentId: reservation.payment_id,
        ticketId: reservation.ticket_id,
        eventTitle: `${reservation.event_title} · ${reservation.batch_name}`,
        amountCents: reservation.amount_cents,
        organizerAmountCents: reservation.net_amount_cents,
        organizerRecipientId: input.pagarmeRecipientId,
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        statusUrl: buyerUrl,
        metadata: {
          payment_id: reservation.payment_id,
          ticket_id: reservation.ticket_id,
          source: "door_sale",
          buyer_cpf: input.buyerCpf,
          buyer_phone: input.buyerPhone,
        },
      });
      providerPreferenceId = checkout.order.id;
      providerPaymentId = checkout.order.charges?.[0]?.id ?? null;
      checkoutUrl = checkout.checkoutUrl;
    }

    await admin
      .from("payments")
      .update({
        provider: "pagarme",
        provider_preference_id: providerPreferenceId,
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
      throw new DoorSaleError("Pagar.me não retornou o link de pagamento", 502, "PAGARME_LINK_MISSING");
    }

    return {
      ...reservation,
      status: "pending",
      buyerUrl,
      checkoutUrl,
      pix: null,
    };
  } catch (cause) {
    if (cause instanceof DoorSaleError) throw cause;

    if (cause instanceof PagarmeRequestError && cause.status >= 400 && cause.status < 500) {
      if (!providerPreferenceId) {
        await compensateRejectedProviderRequest(reservation.payment_id, cause.message);
        throw new DoorSaleError(
          "A Pagar.me recusou os dados da cobrança. Confira os dados do comprador.",
          422,
          "PAGARME_REJECTED",
        );
      }
    }

    throw new DoorSaleError(
      "A Pagar.me demorou para responder. Tente novamente com a mesma venda.",
      503,
      "PAGARME_TEMPORARY_FAILURE",
    );
  }
}

