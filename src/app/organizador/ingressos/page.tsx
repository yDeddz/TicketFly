import { TicketsOperationsTable } from "@/components/tickets-operations-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrganizerTicketsPage() {
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
  if (eventIds.length === 0) {
    return <p className="text-sm text-white/50">Nenhum ingresso ainda. Publique um evento e comece a vender.</p>;
  }

  const { data: tickets } = await admin
    .from("tickets")
    .select("id,code,buyer_name,buyer_email,status,amount_paid_cents,used_at,created_at,events(title),ticket_batches(name)")
    .in("event_id", eventIds)
    .order("created_at", { ascending: false })
    .limit(300);

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
          Status profissional da porta: pago (QR livre), usado (já validado) ou cancelado/reembolsado.
        </p>
      </div>
      <TicketsOperationsTable tickets={rows} mode="organizer" />
    </div>
  );
}
