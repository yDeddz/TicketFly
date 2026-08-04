import Link from "next/link";

import {
  OrganizerAsaasConnectForm,
  OrganizerSetPrimaryMpButton,
} from "@/components/organizer-asaas-connect";
import { formatCurrency } from "@/lib/format";
import { hasMercadoPagoOAuthConfig } from "@/lib/mercado-pago";
import { hasAsaasConfig } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  mp_oauth_not_configured: "OAuth do Mercado Pago ainda não está configurado no servidor (CLIENT_ID / CLIENT_SECRET).",
  mp_oauth_denied: "Conexão com Mercado Pago cancelada ou negada.",
  mp_oauth_state: "Estado OAuth inválido. Tente conectar novamente.",
  mp_oauth_session: "Sessão inválida. Faça login e tente de novo.",
  mp_oauth_organizer: "Organizador não encontrado.",
  mp_oauth_exchange: "Falha ao trocar o código OAuth. Verifique as credenciais da aplicação MP.",
};

export default async function OrganizerPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; asaas?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select(
      "id,trade_name,mp_connection_status,mp_collector_id,primary_payment_provider,asaas_connection_status,asaas_wallet_id,asaas_account_id,service_fee_platform_share_percent,fee_percent_upto_threshold,fee_percent_above_threshold,fee_threshold_cents",
    )
    .eq("user_id", user.id)
    .single();

  if (!organizer) return null;

  const { data: events } = await admin.from("events").select("id").eq("organizer_id", organizer.id);
  const eventIds = (events ?? []).map((e) => e.id);

  let paidNet = 0;
  let paidFeeShare = 0;
  let paidCount = 0;

  if (eventIds.length > 0) {
    const { data: payments } = await admin
      .from("payments")
      .select("net_amount_cents,partner_fee_share_cents,status")
      .in("event_id", eventIds)
      .eq("status", "approved");

    paidCount = payments?.length ?? 0;
    paidNet = payments?.reduce((sum, p) => sum + (p.net_amount_cents ?? 0), 0) ?? 0;
    paidFeeShare = payments?.reduce((sum, p) => sum + (p.partner_fee_share_cents ?? 0), 0) ?? 0;
  }

  const oauthReady = hasMercadoPagoOAuthConfig();
  const asaasConfigured = hasAsaasConfig();
  const mpConnected = organizer.mp_connection_status === "connected";
  const asaasConnected =
    organizer.asaas_connection_status === "connected" && Boolean(organizer.asaas_wallet_id);
  const primary = organizer.primary_payment_provider ?? "mercado_pago";
  const partnerShare = 100 - Number(organizer.service_fee_platform_share_percent ?? 50);
  const error = params.error ? errorMessages[params.error] ?? params.error : null;

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-black">Pagamentos e recebimento</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          Escolha um provedor para receber ingresso + sua fatia da taxa automaticamente no checkout.
          Provedor ativo:{" "}
          <span className="font-bold text-white">
            {primary === "asaas" ? "Asaas" : "Mercado Pago"}
          </span>
          .
        </p>
      </div>

      {params.connected ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          Mercado Pago conectado e definido como provedor ativo.
        </p>
      ) : null}
      {params.asaas ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          Asaas conectado e definido como provedor ativo.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{error}</p>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Mercado Pago</p>
          <p className="mt-2 text-2xl font-black capitalize">{organizer.mp_connection_status}</p>
          {organizer.mp_collector_id ? (
            <p className="mt-1 text-sm text-white/50">Collector ID: {organizer.mp_collector_id}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {oauthReady ? (
              <Link
                href="/api/organizer/mp/connect"
                className="rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white"
              >
                {mpConnected ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
              </Link>
            ) : (
              <span className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/55">
                OAuth pendente de configuração no servidor
              </span>
            )}
            <OrganizerSetPrimaryMpButton enabled={mpConnected} isPrimary={primary === "mercado_pago"} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Contrato de taxa</p>
          <ul className="mt-3 grid gap-2 text-sm text-[#c9aabc]">
            <li>
              Até {formatCurrency(organizer.fee_threshold_cents)}: {organizer.fee_percent_upto_threshold}%
            </li>
            <li>Acima: {organizer.fee_percent_above_threshold}%</li>
            <li>
              Split da taxa: você {partnerShare}% · Ticket Fly {organizer.service_fee_platform_share_percent}%
            </li>
          </ul>
        </div>
      </div>

      <OrganizerAsaasConnectForm
        asaasReady={asaasConnected}
        asaasConfigured={asaasConfigured}
        asaasStatus={organizer.asaas_connection_status}
        asaasWalletId={organizer.asaas_wallet_id}
        primaryProvider={primary}
        tradeName={organizer.trade_name}
        defaultEmail={user.email ?? ""}
      />

      <div className="grid gap-4 sm:grid-cols-3">
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
