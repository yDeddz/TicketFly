import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { computeServiceFee, splitAfterStone, stoneProcessingCents } from "@/lib/fees";
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
  const exampleCharge = example.totalCents;
  const exampleSplit = splitAfterStone({
    ticketPriceCents: EXAMPLE_PRICE_CENTS,
    feeCents: example.feeCents,
    insuranceCents: 0,
    stoneCents: stoneProcessingCents(exampleCharge, "pix"),
    platformSharePercent: platformShare,
  });

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Taxas e repasse</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">
          A TicketFly desconta as taxas de processamento e divide a taxa de serviço{" "}
          <strong className="font-semibold text-white">50% para a casa e 50% para a TicketFly</strong>. O líquido é
          depositado em até 48 horas úteis.
        </p>
      </div>

      <section className="border-t border-white/10 pt-8">
        <h2 className="text-base font-semibold">Como funciona</h2>
        <ol className="mt-3 grid gap-2 text-sm text-white/60">
          <li>1. A TicketFly passa e desconta as taxas de processamento da venda.</li>
          <li>2. Sobre a taxa de serviço, a divisão é {partnerShare}% você · {platformShare}% TicketFly.</li>
          <li>3. O valor líquido chega em até 48 horas úteis.</li>
        </ol>
        <p className="mt-4 text-sm">
          <Link href="/organizador/pagamentos" className="font-medium text-[#ff7ec8] underline">
            Ver faturamento
          </Link>
        </p>
      </section>

      <section className="border-t border-white/10 pt-8">
        <h2 className="text-base font-semibold">Taxas de processamento (repassadas e descontadas)</h2>
        <p className="mt-2 text-sm text-white/55">
          Custos da venda. Pix é só o percentual — não existe tarifa fixa de R$ 0,50.
        </p>
        <div className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <FeeCard label="Pix" value="0,99%" detail="por transação, sem tarifa fixa" />
          <FeeCard label="Cartão à vista" value="a partir de 3,79%" detail="1x, por transação" />
          <FeeCard label="Antifraude" value="R$ 0,40" detail="somente no crédito" />
          <FeeCard label="Transferência" value="R$ 3,67" detail="quando houver TED" />
        </div>
      </section>

      <section className="border-t border-white/10 pt-8">
        <h2 className="text-base font-semibold">Taxa de serviço — 50% / 50%</h2>
        <p className="mt-2 text-sm text-white/55">
          Depois de descontar o processamento, a taxa de serviço do contrato é dividida ao meio.
        </p>
        <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-3">
          <FeeCard label={`Até ${formatCurrency(threshold)}`} value={`${servicePercent}%`} detail="sobre o ingresso" />
          <FeeCard
            label={`Acima de ${formatCurrency(threshold)}`}
            value={`${abovePercent}%`}
            detail="sobre o ingresso"
          />
          <FeeCard label="Divisão" value="50% / 50%" detail={`você ${partnerShare}% · TicketFly ${platformShare}%`} />
        </div>
      </section>

      <section className="border-t border-white/10 pt-8">
        <h2 className="text-base font-semibold">Exemplo — ingresso de {formatCurrency(EXAMPLE_PRICE_CENTS)}</h2>
        <ul className="mt-3 grid gap-2 text-sm text-white/60">
          <li>Processamento Pix (0,99% sobre a cobrança): {formatCurrency(exampleSplit.stoneCents)} descontado da taxa</li>
          <li>
            Taxa de serviço ({example.feePercent}%): {formatCurrency(example.feeCents)} − Pix ={" "}
            {formatCurrency(example.feeCents - exampleSplit.stoneCents)} → você{" "}
            {formatCurrency(exampleSplit.partnerShareCents)} · TicketFly {formatCurrency(exampleSplit.platformShareCents)}
          </li>
          <li>Comprador paga ingresso + taxa de serviço: {formatCurrency(example.totalCents)}</li>
        </ul>
      </section>
    </div>
  );
}

function FeeCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-t border-white/8 py-3">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-white/45">{detail}</p>
    </div>
  );
}
