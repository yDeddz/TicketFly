import { PaymentStatusClient } from "@/components/payment-status-client";
import { publicTicketUrl } from "@/lib/qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signTicketAccessToken } from "@/lib/ticket-crypto";

export const dynamic = "force-dynamic";

export default async function PaymentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();
  const [{ data: payment }, auth] = await Promise.all([
    admin
      .from("payments")
      .select("id,status,amount_cents,checkout_url,tickets(code,status,buyer_email)")
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ]);

  const ticket = Array.isArray(payment?.tickets) ? payment?.tickets[0] : payment?.tickets;

  let ticketHref: string | null = null;
  let ticketAccess: string | null = null;
  if (payment?.status === "approved" && ticket?.code && ticket.buyer_email) {
    try {
      ticketAccess = await signTicketAccessToken({
        code: ticket.code,
        buyerEmail: ticket.buyer_email,
      });
      ticketHref = publicTicketUrl(ticket.code, ticketAccess);
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
                ticketCode: ticket?.code ?? null,
                ticketAccess,
              }
            : null
        }
        ticketHref={ticketHref}
        loggedIn={Boolean(auth.data.user)}
      />
    </main>
  );
}
