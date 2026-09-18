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
    .select(
      "id,trade_name,pagarme_connection_status,service_fee_platform_share_percent,fee_percent_upto_threshold",
    )
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
  const receivingReady = organizer.pagarme_connection_status === "connected";

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-black">Pagamentos e recebimento</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          A TicketFly cadastra você como recebedor na Stone com os dados da ficha. Aqui você só acompanha
          faturamento e repasses — não precisa abrir conta nem conectar nada.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Recebimento Stone</p>
          <p className={`mt-2 text-2xl font-black ${receivingReady ? "text-emerald-300" : "text-amber-200"}`}>
            {receivingReady ? "Configurado" : "Em configuração"}
          </p>
          <p className="mt-2 text-sm text-white/50">
            {receivingReady ? (
              "O recebedor Stone já está cadastrado pela administração TicketFly a partir da sua ficha."
            ) : (
              <>
                A administração TicketFly cadastra o recebedor na Stone com os dados do{" "}
                <Link href="/organizador/perfil" className="font-bold text-white/80 underline">
                  Perfil
                </Link>
                . Você não abre conta nem conecta nada.
              </>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Contrato de taxa</p>
          <ul className="mt-3 grid gap-2 text-sm text-[#c9aabc]">
            <li>
              Taxa de serviço por checkout: {organizer.fee_percent_upto_threshold ?? 12}%
            </li>
            <li>
              Split da taxa: você {partnerShare}% · Ticket Fly {organizer.service_fee_platform_share_percent}%
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

      <section className="rounded-2xl border border-white/10 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Tarifas de processamento Stone</h3>
        <p className="mt-1 text-sm text-white/50">
          Condições comerciais da conta Stone. No TicketFly, cartão é aceito somente à vista (1x).
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <FeeCard label="Pix" value="0,99%" detail="por transação" />
          <FeeCard label="Cartão 1x" value="a partir de 3,79%" detail="por transação" />
          <FeeCard label="Processamento" value="R$ 0,50" detail="por transação aprovada" />
          <FeeCard label="Antifraude" value="R$ 0,40" detail="por transação de crédito" />
          <FeeCard label="Transferência" value="R$ 3,67" detail="por transferência para outra conta" />
          <FeeCard label="Antecipação" value="3,11%" detail="antecipação automática ativa" />
        </div>
        <p className="mt-4 text-xs text-white/40">
          As tarifas são cobradas pela Stone e podem ser atualizadas conforme o contrato da conta.
        </p>
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
