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
          A TicketFly desconta as tarifas na liquidação e faz o repasse em até{" "}
          <strong className="text-white">48 horas úteis</strong> após a venda aprovada.
        </p>
      </div>

      <section className="rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Repasse</h3>
        <p className="mt-2 text-sm text-white/60">
          O valor líquido (ingresso + sua fatia da taxa de serviço, já com o processamento descontado) é depositado
          pela TicketFly em até 48 horas úteis. Você não precisa conectar conta de pagamento.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/organizador/pagamentos" className="font-bold text-[#ff7ec8] underline">
            Ver faturamento
          </Link>
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Taxa de serviço TicketFly</h3>
        <p className="mt-2 text-sm text-white/60">
          Percentual do contrato, cobrado no checkout. Parte dessa taxa volta para você.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <FeeCard label={`Até ${formatCurrency(threshold)}`} value={`${servicePercent}%`} detail="sobre o ingresso" />
          <FeeCard
            label={`Acima de ${formatCurrency(threshold)}`}
            value={`${abovePercent}%`}
            detail="sobre o ingresso"
          />
          <FeeCard label="Split da taxa" value={`você ${partnerShare}%`} detail={`TicketFly ${platformShare}%`} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Processamento</h3>
        <p className="mt-2 text-sm text-white/60">
          Cartão é aceito somente à vista (1x). Pix não tem tarifa fixa — só o percentual.
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <FeeCard label="Pix" value="0,99%" detail="por transação, sem tarifa fixa" />
          <FeeCard label="Cartão 1x" value="a partir de 3,79%" detail="por transação" />
          <FeeCard label="Antifraude" value="R$ 0,40" detail="somente em transação de crédito" />
          <FeeCard label="Transferência" value="R$ 3,67" detail="quando houver TED para outra conta" />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Exemplo — ingresso de {formatCurrency(EXAMPLE_PRICE_CENTS)} no Pix</h3>
        <ul className="mt-3 grid gap-2 text-sm text-[#c9aabc]">
          <li>Comprador paga ingresso + taxa de serviço: {formatCurrency(example.totalCents)}</li>
          <li>
            Taxa de serviço ({example.feePercent}%): {formatCurrency(example.feeCents)} → você{" "}
            {formatCurrency(example.partnerShareCents)} · TicketFly {formatCurrency(example.platformShareCents)}
          </li>
          <li>Pix (0,99% sobre o ingresso, sem tarifa fixa): {formatCurrency(pixCents)}</li>
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
