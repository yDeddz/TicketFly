import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { computeServiceFee } from "@/lib/fees";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EXAMPLE_PRICE_CENTS = 10_000;

export default async function OrganizerFeesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select(
      "fee_threshold_cents,fee_percent_upto_threshold,fee_percent_above_threshold,service_fee_platform_share_percent",
    )
    .eq("user_id", user.id)
    .single();

  if (!organizer) return null;

  const servicePercent = Number(organizer.fee_percent_upto_threshold ?? 12);
  const abovePercent = Number(organizer.fee_percent_above_threshold ?? servicePercent);
  const platformShare = Number(organizer.service_fee_platform_share_percent ?? 50);
  const partnerShare = 100 - platformShare;
  const threshold = Number(organizer.fee_threshold_cents ?? 12_000);
  const example = computeServiceFee(EXAMPLE_PRICE_CENTS, {
    fee_threshold_cents: threshold,
    fee_percent_upto_threshold: servicePercent,
    fee_percent_above_threshold: abovePercent,
    service_fee_platform_share_percent: platformShare,
  });
  const pixCents = Math.round((EXAMPLE_PRICE_CENTS * 99) / 10_000);

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-black">Taxas e repasse</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          A TicketFly desconta as taxas de processamento e divide a taxa de serviço{" "}
          <strong className="text-white">50% para a casa e 50% para a TicketFly</strong>. O líquido é
          depositado em até 48 horas úteis.
        </p>
      </div>

      <section className="rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Como funciona</h3>
        <ol className="mt-3 grid gap-2 text-sm text-[#c9aabc]">
          <li>1. A TicketFly passa e desconta as taxas de processamento da venda.</li>
          <li>2. Sobre a taxa de serviço, a divisão é {partnerShare}% você · {platformShare}% TicketFly.</li>
          <li>3. O valor líquido chega em até 48 horas úteis.</li>
        </ol>
        <p className="mt-4 text-sm">
          <Link href="/organizador/pagamentos" className="font-bold text-[#ff7ec8] underline">
            Ver faturamento
          </Link>
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Taxas de processamento (repassadas e descontadas)</h3>
        <p className="mt-2 text-sm text-white/60">
          Custos da venda. Pix é só o percentual — não existe tarifa fixa de R$ 0,50.
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <FeeCard label="Pix" value="0,99%" detail="por transação, sem tarifa fixa" />
          <FeeCard label="Cartão à vista" value="a partir de 3,79%" detail="1x, por transação" />
          <FeeCard label="Antifraude" value="R$ 0,40" detail="somente no crédito" />
          <FeeCard label="Transferência" value="R$ 3,67" detail="quando houver TED" />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Taxa de serviço — 50% / 50%</h3>
        <p className="mt-2 text-sm text-white/60">
          Depois de descontar o processamento, a taxa de serviço do contrato é dividida ao meio.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <FeeCard label={`Até ${formatCurrency(threshold)}`} value={`${servicePercent}%`} detail="sobre o ingresso" />
          <FeeCard
            label={`Acima de ${formatCurrency(threshold)}`}
            value={`${abovePercent}%`}
            detail="sobre o ingresso"
          />
          <FeeCard label="Divisão" value="50% / 50%" detail={`você ${partnerShare}% · TicketFly ${platformShare}%`} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Exemplo — ingresso de {formatCurrency(EXAMPLE_PRICE_CENTS)}</h3>
        <ul className="mt-3 grid gap-2 text-sm text-[#c9aabc]">
          <li>Processamento Pix (0,99%, sem tarifa fixa): {formatCurrency(pixCents)} descontado</li>
          <li>
            Taxa de serviço ({example.feePercent}%): {formatCurrency(example.feeCents)} → 50% você{" "}
            {formatCurrency(example.partnerShareCents)} · 50% TicketFly {formatCurrency(example.platformShareCents)}
          </li>
          <li>Comprador paga ingresso + taxa de serviço: {formatCurrency(example.totalCents)}</li>
        </ul>
      </section>
    </div>
  );
}

function FeeCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{detail}</p>
    </div>
  );
}
