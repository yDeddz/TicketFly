import Link from "next/link";

import { OpsSetupList } from "@/components/ops-setup-list";
import { StatCard } from "@/components/stat-card";
import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { formatCurrency } from "@/lib/format";
import { isOrganizerProfileComplete, organizerReceivingReady } from "@/lib/organizer-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  cancelled: "Cancelado",
  finished: "Finalizado",
};

export default async function OrganizerDashboardPage() {
  const auth = await requireApprovedOrganizer();
  if (!auth.organizer) return null;

  const organizer = auth.organizer;
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("events")
    .select("id,title,status,starts_at,ticket_batches(id)")
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false });

  const eventIds = (events ?? []).map((event) => event.id);
  const recentIds = eventIds.slice(0, 6);

  let paid = 0;
  let cancelled = 0;
  let checkins = 0;
  let revenue = 0;
  let grossRevenue = 0;
  let feeShare = 0;

  if (eventIds.length > 0) {
    const [paidRes, cancelledRes, checkinRes, paymentsRes] = await Promise.all([
      admin.from("tickets").select("id", { count: "exact", head: true }).in("event_id", eventIds).in("status", ["paid", "used"]),
      admin.from("tickets").select("id", { count: "exact", head: true }).in("event_id", eventIds).eq("status", "cancelled"),
      admin.from("checkins").select("id", { count: "exact", head: true }).in("event_id", eventIds),
      admin
        .from("payments")
        .select("amount_cents,net_amount_cents,partner_fee_share_cents")
        .in("event_id", eventIds)
        .eq("status", "approved"),
    ]);
    paid = paidRes.count ?? 0;
    cancelled = cancelledRes.count ?? 0;
    checkins = checkinRes.count ?? 0;
    revenue = paymentsRes.data?.reduce((sum, payment) => sum + (payment.net_amount_cents ?? 0), 0) ?? 0;
    grossRevenue = paymentsRes.data?.reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0) ?? 0;
    feeShare = paymentsRes.data?.reduce((sum, payment) => sum + (payment.partner_fee_share_cents ?? 0), 0) ?? 0;
  }

  const recentCounts = new Map<string, { sold: number; scanned: number }>();
  if (recentIds.length > 0) {
    const { data: recentTickets } = await admin
      .from("tickets")
      .select("event_id,status")
      .in("event_id", recentIds)
      .in("status", ["paid", "used"]);
    for (const ticket of recentTickets ?? []) {
      const current = recentCounts.get(ticket.event_id) ?? { sold: 0, scanned: 0 };
      current.sold += 1;
      if (ticket.status === "used") current.scanned += 1;
      recentCounts.set(ticket.event_id, current);
    }
  }

  const live = events?.filter((event) => event.status === "published").length ?? 0;
  const hasBatch = (events ?? []).some((event) => (event.ticket_batches?.length ?? 0) > 0);
  const paymentsReady = organizerReceivingReady(organizer);
  const profileComplete = isOrganizerProfileComplete(organizer);

  return (
    <div className="grid gap-8">
      <OpsSetupList
        title="Checklist da casa"
        description="Feche estes itens antes de abrir a venda ao público."
        items={[
          {
            label: "Completar perfil fiscal",
            done: profileComplete,
            href: "/organizador/perfil",
            hint: profileComplete ? "Documento e endereço ok" : "CPF/CNPJ, CEP e telefone",
          },
          {
            label: "Recebimento Stone configurado pela TicketFly",
            done: paymentsReady,
            href: "/organizador/pagamentos",
            hint: paymentsReady
              ? "Split automático ativo"
              : "A administração está cadastrando o recebedor",
          },
          {
            label: "Criar evento",
            done: (events?.length ?? 0) > 0,
            href: "/organizador/eventos",
          },
          {
            label: "Cadastrar lote de ingresso",
            done: hasBatch,
            href: "/organizador/eventos",
            hint: "Sem lote o evento não publica",
          },
          {
            label: "Publicar na vitrine",
            done: live > 0,
            href: "/organizador/eventos",
          },
          {
            label: "Testar check-in",
            done: checkins > 0,
            href: "/organizador/entradas",
            hint: "Compre um ingresso de teste e valide em /checkin",
          },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total faturado" value={formatCurrency(grossRevenue)} />
        <StatCard label="Seu líquido" value={formatCurrency(revenue)} tone="pink" />
        <StatCard label="Sua parte da taxa (6%)" value={formatCurrency(feeShare)} />
        <StatCard label="Vendidos" value={String(paid)} />
        <StatCard label="Cancelados/reembolsos" value={String(cancelled)} tone="light" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
          <h2 className="font-black">Operação de porta</h2>
          <p className="mt-2 text-sm text-[#c9aabc]">
            {checkins} check-ins registrados · {live} evento(s) publicado(s)
          </p>
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
            const counts = recentCounts.get(event.id) ?? { sold: 0, scanned: 0 };
            return (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <strong>{event.title}</strong>
                  <p className="text-sm text-white/50">
                    {statusLabels[event.status] ?? event.status} · {counts.sold} vendidos · {counts.scanned} na porta
                  </p>
                </div>
                <Link href="/organizador/eventos" className="text-sm font-bold text-[#ff7ec8]">
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
