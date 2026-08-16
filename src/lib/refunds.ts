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

  if (paymentId) {
    const { data: payment } = await admin
      .from("payments")
      .select("id,status,provider,provider_payment_id,amount_cents")
      .eq("id", paymentId)
      .single();

    if (
      payment &&
      tryProvider &&
      payment.provider_payment_id &&
      canAttemptProviderRefund(payment.provider)
    ) {
      providerAttempted = true;
      providerRefunded = await refundViaProvider(payment.provider, payment.provider_payment_id);
    }

    if (payment && payment.status !== "refunded") {
      await admin
        .from("payments")
        .update({
          status: "refunded",
          raw_payload: {
            refunded_by: args.actorUserId,
            reason: args.reason ?? null,
            provider_refund_attempted: providerAttempted,
            provider_refunded: providerRefunded,
            mp_refund_attempted: providerAttempted,
            mp_refunded: providerRefunded,
            at: new Date().toISOString(),
          },
        })
        .eq("id", payment.id);
    }
  }

  const previousStatus = ticket.status;

  await admin
    .from("tickets")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: args.actorUserId,
    })
    .eq("id", ticket.id);

  // Invalidate any live QR / Wallet barcodes bound to the previous secret.
  await admin.rpc("rotate_ticket_qr_token", { p_ticket_id: ticket.id });

  const { data: batch } = await admin
    .from("ticket_batches")
    .select("quantity_sold,quantity_reserved")
    .eq("id", ticket.ticket_batch_id)
    .single();

  if (batch) {
    if (previousStatus === "paid" || previousStatus === "used") {
      await admin
        .from("ticket_batches")
        .update({ quantity_sold: Math.max((batch.quantity_sold ?? 0) - 1, 0) })
        .eq("id", ticket.ticket_batch_id);
    } else if (previousStatus === "pending") {
      await admin
        .from("ticket_batches")
        .update({ quantity_reserved: Math.max((batch.quantity_reserved ?? 0) - 1, 0) })
        .eq("id", ticket.ticket_batch_id);
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
