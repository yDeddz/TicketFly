import { PaymentStatusClient } from "@/components/payment-status-client";
import { publicTicketUrl } from "@/lib/qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { signTicketAccessToken } from "@/lib/ticket-crypto";

export const dynamic = "force-dynamic";

export default async function PaymentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id,status,amount_cents,checkout_url,tickets(code,status,buyer_email)")
    .eq("id", id)
    .single();

  const ticket = Array.isArray(payment?.tickets) ? payment?.tickets[0] : payment?.tickets;

  let ticketHref: string | null = null;
  if (payment?.status === "approved" && ticket?.code && ticket.buyer_email) {
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

  return (
    <main className="mx-auto grid max-w-3xl gap-5 px-4 pb-10 pt-8">
      <PaymentStatusClient
        paymentId={id}
        initial={
          payment
            ? {
                id: payment.id,
                status: payment.status,
                amount_cents: payment.amount_cents,
                checkout_url: payment.checkout_url,
                tickets: payment.tickets,
              }
            : null
        }
        ticketHref={ticketHref}
      />
    </main>
  );
}
