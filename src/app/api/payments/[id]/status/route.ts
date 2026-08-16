import { NextResponse } from "next/server";

import { apiError, createRequestId } from "@/lib/api-error";
import { publicTicketUrl } from "@/lib/qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { signTicketAccessToken } from "@/lib/ticket-crypto";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId(request);
  const { id } = await context.params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("payments")
    .select(
      "id,status,checkout_url,amount_cents,provider_payment_id,tickets(code,status,buyer_email)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return apiError(404, {
      message: "Pagamento não encontrado",
      code: "PAYMENT_NOT_FOUND",
      requestId,
    });
  }

  const ticket = Array.isArray(data.tickets) ? data.tickets[0] : data.tickets;
  let ticketHref: string | null = null;

  if (data.status === "approved" && ticket?.code && ticket.buyer_email) {
    try {
      const access = await signTicketAccessToken({
        code: ticket.code,
        buyerEmail: ticket.buyer_email,
      });
      ticketHref = publicTicketUrl(ticket.code, access);
    } catch {
      ticketHref = publicTicketUrl(ticket.code);
    }
  }

  return NextResponse.json(
    { ...data, ticketHref, requestId },
    { headers: { "x-request-id": requestId } },
  );
}
