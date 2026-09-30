import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrganizerPaymentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,service_fee_platform_share_percent,fee_percent_upto_threshold")
    .eq("user_id", user.id)
    .single();

  if (!organizer) return null;

  const { data: events } = await admin.from("events").select("id").eq("organizer_id", organizer.id);
  const eventIds = (events ?? []).map((e) => e.id);

  let paidNet = 0;
  let paidFeeShare = 0;
  let grossRevenue = 0;
  let paidCount = 0;

  if (eventIds.length > 0) {
    const { data: payments } = await admin
      .from("payments")
      .select("amount_cents,net_amount_cents,partner_fee_share_cents,status")
      .in("event_id", eventIds)
      .eq("status", "approved");

    paidCount = payments?.length ?? 0;
    paidNet = payments?.reduce((sum, p) => sum + (p.net_amount_cents ?? 0), 0) ?? 0;
    paidFeeShare = payments?.reduce((sum, p) => sum + (p.partner_fee_share_cents ?? 0), 0) ?? 0;
    grossRevenue = payments?.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0) ?? 0;
  }

  const partnerShare = 100 - Number(organizer.service_fee_platform_share_percent ?? 50);

  const totals = [
    { label: "Total faturado", value: formatCurrency(grossRevenue) },
    { label: "Vendas aprovadas", value: String(paidCount) },
    { label: "Seu líquido (ingresso + fatia taxa)", value: formatCurrency(paidNet) },
    { label: "Sua fatia da taxa", value: formatCurrency(paidFeeShare) },
  ];

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pagamentos</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">
          A TicketFly desconta as taxas de processamento, divide a taxa de serviço{" "}
          <strong className="font-semibold text-white">50% / 50%</strong> e faz o repasse em até{" "}
          <strong className="font-semibold text-white">48 horas úteis</strong>. Veja o detalhe em{" "}
          <Link href="/organizador/taxas" className="font-semibold text-white underline">
            Taxas
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-8 border-t border-white/10 pt-8 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-white/50">Prazo de repasse</h2>
          <p className="mt-2 text-2xl font-semibold tracking-tight">48 horas úteis</p>
          <p className="mt-2 text-sm text-white/55">
            Depois da venda aprovada, a TicketFly deposita o líquido na conta da casa.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-white/50">Divisão da taxa</h2>
          <ul className="mt-3 grid gap-2 text-sm text-white/60">
            <li>Taxa de serviço: {organizer.fee_percent_upto_threshold ?? 12}%</li>
            <li>
              Após descontar as taxas de processamento: você {partnerShare}% · TicketFly{" "}
              {organizer.service_fee_platform_share_percent}%
            </li>
          </ul>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-6 border-t border-white/10 pt-8 xl:grid-cols-4">
        {totals.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-white/50">{item.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
