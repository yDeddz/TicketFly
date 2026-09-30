import Link from "next/link";
import { Check, Circle } from "lucide-react";

import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { formatCurrency } from "@/lib/format";
import { isOrganizerProfileComplete } from "@/lib/organizer-profile";
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
  const profileComplete = isOrganizerProfileComplete(organizer);
  const checklist = [
    {
      label: "Completar perfil da casa",
      done: profileComplete,
      href: "/organizador/perfil",
      hint: profileComplete ? "Documento e endereço ok" : "CPF/CNPJ, CEP e telefone",
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
  ];
  const pending = checklist.filter((item) => !item.done).length;
  const stats = [
    { label: "Total faturado", value: formatCurrency(grossRevenue) },
    { label: "Seu líquido", value: formatCurrency(revenue) },
    { label: "Sua parte da taxa (6%)", value: formatCurrency(feeShare) },
    { label: "Vendidos", value: String(paid) },
    { label: "Cancelados/reembolsos", value: String(cancelled) },
  ];

  return (
    <div className="grid gap-10">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <h1 className="text-lg font-semibold">Checklist da casa</h1>
            <p className="mt-1 text-sm text-white/55">Feche estes itens antes de abrir a venda ao público.</p>
          </div>
          <p className="text-sm text-white/45">{pending === 0 ? "Pronto para operar" : `${pending} pendente(s)`}</p>
        </div>
        <ol className="mt-4 divide-y divide-white/8 border-y border-white/10">
          {checklist.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="flex items-start gap-3 py-3">
                {item.done ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff7ec8]" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                )}
                <span>
                  <span className={`block text-sm font-medium ${item.done ? "text-white/60" : "text-white"}`}>{item.label}</span>
                  {item.hint ? <span className="mt-0.5 block text-xs text-white/45">{item.hint}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-6 border-y border-white/10 py-5 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-sm text-white/50">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <h2 className="text-base font-semibold">Operação de porta</h2>
          <p className="mt-1 text-sm text-white/55">
            {checkins} check-ins registrados · {live} evento(s) publicado(s)
          </p>
          <Link href="/organizador/entradas" className="mt-3 inline-flex text-sm font-medium text-[#ff7ec8] hover:text-white">
            Abrir gestão de entrada →
          </Link>
        </div>
        <div>
          <h2 className="text-base font-semibold">Eventos</h2>
          <p className="mt-1 text-sm text-white/55">Crie noites, lotes e publique para vender.</p>
          <Link href="/organizador/eventos" className="mt-3 inline-flex text-sm font-medium text-[#ff7ec8] hover:text-white">
            Gerenciar eventos →
          </Link>
        </div>
        <div>
          <h2 className="text-base font-semibold">Reembolsos</h2>
          <p className="mt-1 text-sm text-white/55">Cancele ingressos e devolva valores com rastreio.</p>
          <Link href="/organizador/reembolsos" className="mt-3 inline-flex text-sm font-medium text-[#ff7ec8] hover:text-white">
            Ver reembolsos →
          </Link>
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold">Próximos / recentes</h2>
        <div className="mt-3 divide-y divide-white/8 border-t border-white/10">
          {(events ?? []).slice(0, 6).map((event) => {
            const counts = recentCounts.get(event.id) ?? { sold: 0, scanned: 0 };
            return (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <strong className="font-medium">{event.title}</strong>
                  <p className="text-sm text-white/50">
                    {statusLabels[event.status] ?? event.status} · {counts.sold} vendidos · {counts.scanned} na porta
                  </p>
                </div>
                <Link href="/organizador/eventos" className="text-sm font-medium text-[#ff7ec8]">
                  Detalhes
                </Link>
              </div>
            );
          })}
          {(events?.length ?? 0) === 0 ? (
            <p className="py-8 text-sm text-white/45">Nenhum evento ainda. Crie o primeiro em Eventos.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
