import { paymentClient } from "@/lib/mercado-pago";
import { notifySaleRefunded } from "@/lib/organizer-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

function hasRealMercadoPagoToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "";
  return token.startsWith("APP_USR-") && !token.includes("your-access-token");
}

export async function refundTicketLocally(args: {
  ticketId: string;
  actorUserId: string;
  reason?: string;
  tryMercadoPago?: boolean;
}) {
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

  let mpRefunded = false;
  const paymentId = ticket.payment_id;

  if (paymentId) {
    const { data: payment } = await admin
      .from("payments")
      .select("id,status,provider_payment_id,amount_cents")
      .eq("id", paymentId)
      .single();

    if (
      payment &&
      args.tryMercadoPago &&
      payment.provider_payment_id &&
      hasRealMercadoPagoToken()
    ) {
      try {
        const client = paymentClient() as unknown as {
          refund: (payload: { id: string | number }) => Promise<unknown>;
        };
        await client.refund({ id: payment.provider_payment_id });
        mpRefunded = true;
      } catch {
        mpRefunded = false;
      }
    }

    if (payment && payment.status !== "refunded") {
      await admin
        .from("payments")
        .update({
          status: "refunded",
          raw_payload: {
            refunded_by: args.actorUserId,
            reason: args.reason ?? null,
            mp_refund_attempted: Boolean(args.tryMercadoPago),
            mp_refunded: mpRefunded,
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

  return { ok: true as const, mpRefunded, paymentId };
}
