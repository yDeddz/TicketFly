import { TicketsOperationsTable } from "@/components/tickets-operations-table";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const admin = createAdminClient();
  const { data: tickets } = await admin
    .from("tickets")
    .select(
      "id,code,buyer_name,buyer_email,status,amount_paid_cents,used_at,created_at,events(title),ticket_batches(name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows =
    tickets?.map((ticket) => ({
      ...ticket,
      events: Array.isArray(ticket.events) ? ticket.events[0] ?? null : ticket.events ?? null,
      ticket_batches: Array.isArray(ticket.ticket_batches)
        ? ticket.ticket_batches[0] ?? null
        : ticket.ticket_batches ?? null,
    })) ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-black">Ingressos e QR Code</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          Acompanhe se o QR ainda está livre ou já foi validado na porta. Reembolse quando necessário.
        </p>
      </div>
      <TicketsOperationsTable tickets={rows} mode="admin" />
    </div>
  );
}
