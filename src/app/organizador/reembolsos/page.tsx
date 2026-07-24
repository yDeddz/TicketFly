import { TicketsOperationsTable } from "@/components/tickets-operations-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrganizerRefundsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: organizer } = await admin.from("organizers").select("id").eq("user_id", user.id).single();
  if (!organizer) return null;

  const { data: events } = await admin.from("events").select("id").eq("organizer_id", organizer.id);
  const eventIds = (events ?? []).map((e) => e.id);

  const { data: tickets } = eventIds.length
    ? await admin
        .from("tickets")
        .select("id,code,buyer_name,buyer_email,status,amount_paid_cents,used_at,created_at,cancelled_at,events(title),ticket_batches(name)")
        .in("event_id", eventIds)
        .in("status", ["paid", "used", "cancelled", "pending"])
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as never[] };

  const rows =
    tickets?.map((ticket) => ({
      ...ticket,
      events: Array.isArray(ticket.events) ? ticket.events[0] ?? null : ticket.events ?? null,
      ticket_batches: Array.isArray(ticket.ticket_batches)
        ? ticket.ticket_batches[0] ?? null
        : ticket.ticket_batches ?? null,
    })) ?? [];

  const refunded = rows.filter((t) => t.status === "cancelled");

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-black">Reembolsos</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          {refunded.length} cancelado(s)/reembolsado(s). Use a ação “Reembolsar” nos ingressos ativos para
          devolver e liberar estoque.
        </p>
      </div>
      <TicketsOperationsTable tickets={rows} mode="organizer" />
    </div>
  );
}
