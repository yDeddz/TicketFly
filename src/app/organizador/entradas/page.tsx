import Link from "next/link";

import { TicketStatusBadge } from "@/components/status-badges";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrganizerEntryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: organizer } = await admin.from("organizers").select("id").eq("user_id", user.id).single();
  if (!organizer) return null;

  const { data: events } = await admin
    .from("events")
    .select("id,title,status,starts_at,tickets(status),checkins(id,result,created_at,message)")
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false });

  const eventIds = (events ?? []).map((event) => event.id);
  const { data: recentTickets } = eventIds.length
    ? await admin
        .from("tickets")
        .select("id,buyer_name,status,used_at,event_id,events(title)")
        .in("event_id", eventIds)
        .in("status", ["paid", "used"])
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as never[] };

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Gestão de entrada</h2>
          <p className="mt-1 text-sm text-[#c9aabc]">
            Visão da porta: quem ainda pode entrar e quem já validou o QR.
          </p>
        </div>
        <Link href="/checkin" className="rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white">
          Abrir scanner QR
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(events ?? []).map((event) => {
          const tickets = event.tickets ?? [];
          const paid = tickets.filter((t) => t.status === "paid").length;
          const used = tickets.filter((t) => t.status === "used").length;
          const validScans = (event.checkins ?? []).filter((c) => c.result === "valid").length;
          return (
            <div key={event.id} className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-lg">{event.title}</strong>
                  <p className="text-sm text-white/50">{formatDateTime(event.starts_at)} · {event.status}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/60">
                  {used}/{used + paid} na casa
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <Metric label="QR livres" value={String(paid)} />
                <Metric label="Já usados" value={String(used)} />
                <Metric label="Scans OK" value={String(validScans)} />
              </div>
            </div>
          );
        })}
        {(events?.length ?? 0) === 0 ? (
          <p className="text-sm text-white/45">Publique um evento para começar a operar a porta.</p>
        ) : null}
      </div>

      <section className="rounded-2xl border border-[#ff1493]/25 bg-[#120410]">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="font-black">Fila recente de ingressos pagos/usados</h3>
        </div>
        <div className="divide-y divide-white/8">
          {(recentTickets ?? []).map((ticket) => {
            const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;
            return (
              <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <strong>{ticket.buyer_name}</strong>
                  <p className="text-xs text-white/45">{event?.title}</p>
                </div>
                <div className="text-right">
                  <TicketStatusBadge status={ticket.status} />
                  {ticket.used_at ? (
                    <p className="mt-1 text-xs text-sky-200/80">{formatDateTime(ticket.used_at)}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
          {(recentTickets?.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-sm text-white/45">Sem movimentação de entrada ainda.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-3">
      <strong className="block text-xl text-white">{value}</strong>
      <span className="text-xs text-white/45">{label}</span>
    </div>
  );
}
