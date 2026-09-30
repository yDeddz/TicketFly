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
    <div className="grid gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestão de entrada</h1>
          <p className="mt-1 text-sm text-white/55">
            Visão da porta: quem ainda pode entrar e quem já validou o QR.
          </p>
        </div>
        <Link href="/checkin" className="rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-semibold text-white">
          Abrir scanner QR
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(events ?? []).map((event) => {
          const tickets = event.tickets ?? [];
          const paid = tickets.filter((t) => t.status === "paid").length;
          const used = tickets.filter((t) => t.status === "used").length;
          const validScans = (event.checkins ?? []).filter((c) => c.result === "valid").length;
          return (
            <div key={event.id} className="border-t border-white/10 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="font-medium">{event.title}</strong>
                  <p className="text-sm text-white/50">{formatDateTime(event.starts_at)} · {event.status}</p>
                </div>
                <span className="shrink-0 text-xs text-white/50">
                  {used}/{used + paid} na casa
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
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

      <section>
        <h2 className="text-base font-semibold">Fila recente de ingressos pagos/usados</h2>
        <div className="mt-3 divide-y divide-white/8 border-t border-white/10">
          {(recentTickets ?? []).map((ticket) => {
            const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;
            return (
              <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <strong className="font-medium">{ticket.buyer_name}</strong>
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
            <p className="py-8 text-sm text-white/45">Sem movimentação de entrada ainda.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong className="block text-lg font-semibold tabular-nums text-white">{value}</strong>
      <span className="text-xs text-white/45">{label}</span>
    </div>
  );
}
