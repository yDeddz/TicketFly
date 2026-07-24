import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { formatCurrency } from "@/lib/format";
import { hasSupabaseConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <p className="text-[#c9aabc]">Configure o Supabase para liberar a administração.</p>;
  }

  const admin = createAdminClient();
  const [{ data: payments }, { data: organizers }, { data: events }, { count: ticketCount }, { count: usedCount }] =
    await Promise.all([
      admin.from("payments").select("amount_cents,platform_fee_cents,net_amount_cents,status"),
      admin.from("organizers").select("id,status"),
      admin.from("events").select("id,status"),
      admin.from("tickets").select("id", { count: "exact", head: true }).in("status", ["paid", "used"]),
      admin.from("tickets").select("id", { count: "exact", head: true }).eq("status", "used"),
    ]);

  const approved = payments?.filter((p) => p.status === "approved") ?? [];
  const refunded = payments?.filter((p) => p.status === "refunded") ?? [];
  const gmv = approved.reduce((sum, p) => sum + p.amount_cents, 0);
  const fee = approved.reduce((sum, p) => sum + p.platform_fee_cents, 0);
  const net = approved.reduce((sum, p) => sum + p.net_amount_cents, 0);
  const pendingPartners = organizers?.filter((o) => o.status === "pending").length ?? 0;
  const liveEvents = events?.filter((e) => e.status === "published").length ?? 0;

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="GMV (aprovado)" value={formatCurrency(gmv)} tone="pink" />
        <StatCard label="Taxa de serviço" value={formatCurrency(fee)} />
        <StatCard label="Líquido baladas" value={formatCurrency(net)} />
        <StatCard label="Ingressos pagos" value={String(ticketCount ?? 0)} tone="light" />
        <StatCard label="QR validados" value={String(usedCount ?? 0)} tone="light" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickCard
          title="Contratos"
          body={`${pendingPartners} pendente(s) · ${organizers?.length ?? 0} no total`}
          href="/admin/contratos"
          cta="Gerenciar contratos"
        />
        <QuickCard
          title="Eventos ao vivo"
          body={`${liveEvents} publicados · ${events?.length ?? 0} no total`}
          href="/admin/eventos"
          cta="Ver eventos"
        />
        <QuickCard
          title="Reembolsos"
          body={`${refunded.length} pagamento(s) reembolsado(s)`}
          href="/admin/pagamentos"
          cta="Abrir pagamentos"
        />
      </div>
    </div>
  );
}

function QuickCard({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm text-[#c9aabc]">{body}</p>
      <Link href={href} className="mt-4 inline-flex text-sm font-bold text-[#ff7ec8] hover:text-white">
        {cta} →
      </Link>
    </div>
  );
}
