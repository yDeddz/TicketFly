import { asaasGetPixQrCode } from "@/lib/payments/asaas-client";
import { publicTicketUrl } from "@/lib/qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  signDoorPaymentAccessToken,
  signTicketAccessToken,
} from "@/lib/ticket-crypto";

export async function loadDoorSaleStatus(paymentId: string) {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select(
      "id,status,amount_cents,payment_method,checkout_url,provider_payment_id,event_id,ticket_batch_id,created_by,sales_channel,events(title,organizer_id),ticket_batches(name),tickets(id,code,status,buyer_email)",
    )
    .eq("id", paymentId)
    .eq("sales_channel", "door")
    .maybeSingle();

  if (!payment) return null;

  const event = Array.isArray(payment.events) ? payment.events[0] : payment.events;
  const batch = Array.isArray(payment.ticket_batches)
    ? payment.ticket_batches[0]
    : payment.ticket_batches;
  const ticket = Array.isArray(payment.tickets) ? payment.tickets[0] : payment.tickets;

  let pix: Awaited<ReturnType<typeof asaasGetPixQrCode>> | null = null;
  if (
    payment.status === "pending" &&
    payment.payment_method === "pix" &&
    payment.provider_payment_id
  ) {
    try {
      pix = await asaasGetPixQrCode(payment.provider_payment_id);
    } catch {
      pix = null;
    }
  }

  let ticketHref: string | null = null;
  if (payment.status === "approved" && ticket?.code && ticket.buyer_email) {
    const access = await signTicketAccessToken({
      code: ticket.code,
      buyerEmail: ticket.buyer_email,
    });
    ticketHref = publicTicketUrl(ticket.code, access);
  }

  const buyerToken = await signDoorPaymentAccessToken({ paymentId: payment.id });

  return {
    paymentId: payment.id,
    status: payment.status,
    amountCents: payment.amount_cents,
    paymentMethod: payment.payment_method,
    checkoutUrl: payment.checkout_url,
    buyerToken,
    pix,
    ticketHref,
    ticketStatus: ticket?.status ?? null,
    eventTitle: event?.title ?? "Evento",
    organizerId: event?.organizer_id ?? null,
    batchName: batch?.name ?? "Ingresso",
    createdBy: payment.created_by,
  };
}

