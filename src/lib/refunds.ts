import { refundViaProvider } from "@/lib/payments";
import { notifySaleRefunded } from "@/lib/organizer-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

function hasRealMercadoPagoToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "";
  return token.startsWith("APP_USR-") && !token.includes("your-access-token");
}

function canAttemptProviderRefund(provider: string | null | undefined) {
  if (provider === "asaas") {
    const key = process.env.ASAAS_API_KEY ?? "";
    return Boolean(key) && !key.includes("your-");
  }
  return hasRealMercadoPagoToken();
}

export async function refundTicketLocally(args: {
  ticketId: string;
  actorUserId: string;
  reason?: string;
  tryMercadoPago?: boolean;
  tryProviderRefund?: boolean;
}) {
  const tryProvider = args.tryProviderRefund ?? args.tryMercadoPago ?? false;
  const admin = createAdminClient();
  const { data: ticket, error: ticketError } = await admin
    .from("tickets")
    .select("id,status,payment_id,ticket_batch_id")
    .eq("id", args.ticketId)
    .single();

  if (ticketError || !ticket) {
    return { ok: false as const, error: "Ingresso não encontrado", status: 404 };
  }

  if (!["pending", "paid", "used"].includes(ticket.status)) {
    return { ok: false as const, error: "Ingresso não pode ser reembolsado neste status", status: 409 };
  }

  let providerRefunded = false;
  let providerAttempted = false;
  const paymentId = ticket.payment_id;
  let providerPaymentId: string | null = null;

  if (paymentId) {
    const { data: payment } = await admin
      .from("payments")
      .select("id,status,provider,provider_payment_id,amount_cents")
      .eq("id", paymentId)
      .single();

    providerPaymentId = payment?.provider_payment_id ?? null;

    if (
      payment &&
      tryProvider &&
      payment.provider_payment_id &&
      canAttemptProviderRefund(payment.provider)
    ) {
      providerAttempted = true;
      providerRefunded = await refundViaProvider(payment.provider, payment.provider_payment_id);
    }
  }

  if (!paymentId) {
    if (ticket.status !== "pending") {
      return { ok: false as const, error: "Ingresso pago sem pagamento vinculado", status: 409 };
    }
    const { error: releaseError } = await admin.rpc("release_reserved_ticket", {
      p_ticket_id: args.ticketId,
    });
    if (releaseError) {
      return { ok: false as const, error: "Não foi possível cancelar o ingresso", status: 500 };
    }
  } else {
    const { error: cancelError } = await admin.rpc("apply_payment_status", {
      p_payment_id: paymentId,
      p_status: ticket.status === "pending" ? "cancelled" : "refunded",
      p_provider_payment_id: providerPaymentId,
      p_payload: {
        source: "refundTicketLocally",
        actor: args.actorUserId,
        reason: args.reason ?? null,
        provider_refund_attempted: providerAttempted,
        provider_refunded: providerRefunded,
      },
    });

    if (cancelError) {
      return { ok: false as const, error: "Não foi possível cancelar o ingresso", status: 500 };
    }
  }

  await notifySaleRefunded({ paymentId: paymentId ?? null, ticketId: ticket.id });

  return {
    ok: true as const,
    mpRefunded: providerRefunded,
    providerRefunded,
    providerAttempted,
    partial: providerAttempted && !providerRefunded,
    paymentId,
  };
}
