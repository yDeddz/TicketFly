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

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-black">Pagamentos</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          A TicketFly desconta as taxas de processamento, divide a taxa de serviço{" "}
          <strong className="text-white">50% / 50%</strong> e faz o repasse em até{" "}
          <strong className="text-white">48 horas úteis</strong>. Veja o detalhe em{" "}
          <Link href="/organizador/taxas" className="font-bold text-white underline">
            Taxas
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Prazo de repasse</p>
          <p className="mt-2 text-2xl font-black text-emerald-300">48 horas úteis</p>
          <p className="mt-2 text-sm text-white/50">
            Depois da venda aprovada, a TicketFly deposita o líquido na conta da casa.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Divisão da taxa</p>
          <ul className="mt-3 grid gap-2 text-sm text-[#c9aabc]">
            <li>Taxa de serviço: {organizer.fee_percent_upto_threshold ?? 12}%</li>
            <li>
              Após descontar as taxas de processamento: você {partnerShare}% · TicketFly{" "}
              {organizer.service_fee_platform_share_percent}%
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#120410] p-5">
          <p className="text-xs uppercase text-white/45">Total faturado</p>
          <p className="mt-2 text-2xl font-black">{formatCurrency(grossRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#120410] p-5">
          <p className="text-xs uppercase text-white/45">Vendas aprovadas</p>
          <p className="mt-2 text-2xl font-black">{paidCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#120410] p-5">
          <p className="text-xs uppercase text-white/45">Seu líquido (ingresso + fatia taxa)</p>
          <p className="mt-2 text-2xl font-black text-[#ff7ec8]">{formatCurrency(paidNet)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#120410] p-5">
          <p className="text-xs uppercase text-white/45">Sua fatia da taxa</p>
          <p className="mt-2 text-2xl font-black">{formatCurrency(paidFeeShare)}</p>
        </div>
      </div>
    </div>
  );
}
