import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { formatCurrency } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrganizerDashboardPage() {
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
    .select("id,title,status,starts_at,tickets(status,amount_paid_cents,payment_id),checkins(id)")
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false });

  const tickets = events?.flatMap((e) => e.tickets ?? []) ?? [];
  const paid = tickets.filter((t) => t.status === "paid" || t.status === "used");
  const used = tickets.filter((t) => t.status === "used");
  const cancelled = tickets.filter((t) => t.status === "cancelled");

  const paymentIds = [
    ...new Set(paid.map((t) => t.payment_id).filter((id): id is string => Boolean(id))),
  ];

  let revenue = 0;
  if (paymentIds.length > 0) {
    const { data: payments } = await admin
      .from("payments")
      .select("net_amount_cents")
      .in("id", paymentIds)
      .eq("status", "approved");
    revenue = payments?.reduce((sum, p) => sum + (p.net_amount_cents ?? 0), 0) ?? 0;
  }

  // Fallback for legacy tickets without payment net ledger
  if (revenue === 0 && paid.length > 0 && paymentIds.length === 0) {
    revenue = paid.reduce((sum, t) => sum + (t.amount_paid_cents ?? 0), 0);
  }

  const checkins = events?.reduce((sum, e) => sum + (e.checkins?.length ?? 0), 0) ?? 0;
  const live = events?.filter((e) => e.status === "published").length ?? 0;

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Receita líquida (você)" value={formatCurrency(revenue)} tone="pink" />
        <StatCard label="Vendidos" value={String(paid.length)} />
        <StatCard label="QR validados" value={String(used.length)} />
        <StatCard label="Aguardando entrada" value={String(paid.length - used.length)} tone="light" />
        <StatCard label="Cancelados/reembolsos" value={String(cancelled.length)} tone="light" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
          <h2 className="font-black">Operação de porta</h2>
          <p className="mt-2 text-sm text-[#c9aabc]">{checkins} check-ins registrados · {live} evento(s) publicado(s)</p>
          <Link href="/organizador/entradas" className="mt-4 inline-flex text-sm font-bold text-[#ff7ec8] hover:text-white">
            Abrir gestão de entrada →
          </Link>
        </div>
        <div className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
          <h2 className="font-black">Eventos</h2>
          <p className="mt-2 text-sm text-[#c9aabc]">Crie noites, lotes e publique para vender.</p>
          <Link href="/organizador/eventos" className="mt-4 inline-flex text-sm font-bold text-[#ff7ec8] hover:text-white">
            Gerenciar eventos →
          </Link>
        </div>
        <div className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
          <h2 className="font-black">Reembolsos</h2>
          <p className="mt-2 text-sm text-[#c9aabc]">Cancele ingressos e devolva valores com rastreio.</p>
          <Link href="/organizador/reembolsos" className="mt-4 inline-flex text-sm font-bold text-[#ff7ec8] hover:text-white">
            Ver reembolsos →
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-[#ff1493]/25 bg-[#120410]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-black">Próximos / recentes</h2>
        </div>
        <div className="divide-y divide-white/8">
          {(events ?? []).slice(0, 6).map((event) => {
            const eventTickets = event.tickets ?? [];
            const sold = eventTickets.filter((t) => t.status === "paid" || t.status === "used").length;
            const scanned = eventTickets.filter((t) => t.status === "used").length;
            return (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <strong>{event.title}</strong>
                  <p className="text-sm text-white/50">{event.status} · {sold} vendidos · {scanned} na porta</p>
                </div>
                <Link href={`/organizador/eventos`} className="text-sm font-bold text-[#ff7ec8]">
                  Detalhes
                </Link>
              </div>
            );
          })}
          {(events?.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-sm text-white/45">Nenhum evento ainda. Crie o primeiro em Eventos.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
