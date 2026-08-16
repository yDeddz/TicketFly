import { CalendarDays, MapPin, Music2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { CheckoutForm } from "@/components/checkout-form";
import { formatDateTime } from "@/lib/format";
import { DEFAULT_FEE_CONTRACT, type FeeContract } from "@/lib/fees";
import { hasSupabaseConfig } from "@/lib/env";
import { resolveCheckoutProvider } from "@/lib/payments";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getShowcaseEvent } from "@/lib/ticketfly-data";
import type { EventWithBatches } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string; cupom?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  let event: EventWithBatches | null = null;
  let demoMode = true;
  let buyerName = "";
  let buyerEmail = "";

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const [{ data }, auth] = await Promise.all([
      supabase
        .from("events")
        .select(
          "*, organizers(trade_name, fee_threshold_cents, fee_percent_upto_threshold, fee_percent_above_threshold, service_fee_platform_share_percent, mp_connection_status, asaas_connection_status, asaas_wallet_id, primary_payment_provider), ticket_batches(*)",
        )
        .eq("slug", slug)
        .single(),
      supabase.auth.getUser(),
    ]);

    event = (data ?? null) as EventWithBatches | null;
    demoMode = false;
    const user = auth.data.user;
    buyerEmail = user?.email?.trim() ?? "";
    buyerName =
      (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") ||
      (typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "");
  }

  if (!event) {
    event = getShowcaseEvent(slug) ?? null;
    demoMode = true;
  }

  if (!event) {
    notFound();
  }

  const activeBatches = event.ticket_batches
    .filter((batch) => batch.is_active)
    .sort((a, b) => a.price_cents - b.price_cents);

  const feeContract: FeeContract = {
    fee_threshold_cents: event.organizers?.fee_threshold_cents ?? DEFAULT_FEE_CONTRACT.fee_threshold_cents,
    fee_percent_upto_threshold:
      event.organizers?.fee_percent_upto_threshold ?? DEFAULT_FEE_CONTRACT.fee_percent_upto_threshold,
    fee_percent_above_threshold:
      event.organizers?.fee_percent_above_threshold ?? DEFAULT_FEE_CONTRACT.fee_percent_above_threshold,
    service_fee_platform_share_percent:
      event.organizers?.service_fee_platform_share_percent ??
      DEFAULT_FEE_CONTRACT.service_fee_platform_share_percent,
  };

  const remainingTickets = activeBatches.reduce((sum, batch) => {
    return sum + Math.max(0, batch.quantity_total - batch.quantity_reserved - batch.quantity_sold);
  }, 0);
  const paymentProvider = resolveCheckoutProvider({
    primary_payment_provider: event.organizers?.primary_payment_provider ?? null,
    mp_access_token: null,
    mp_connection_status: event.organizers?.mp_connection_status ?? null,
    asaas_wallet_id: event.organizers?.asaas_wallet_id ?? null,
    asaas_connection_status: event.organizers?.asaas_connection_status ?? null,
  }).provider;

  return (
    <main className="ticket-grid">
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(5,5,5,.96), rgba(5,5,5,.68) 48%, rgba(255,20,147,.12)), linear-gradient(180deg, transparent, #050505 96%), url(${event.cover_image_url ?? "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1800&q=85"})`,
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-14 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-6 lg:pt-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#ff1493]/35 bg-[#ff1493]/10 px-4 py-2 text-xs font-black uppercase text-[#ff7ec8] backdrop-blur-md">
              <span className="live-dot h-2 w-2 rounded-full bg-[#ff1493]" />
              Venda ativa
            </p>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-none md:text-7xl">{event.title}</h1>
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-white/72">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2">
                <CalendarDays className="h-4 w-4 text-[#ff1493]" />
                {formatDateTime(event.starts_at)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2">
                <MapPin className="h-4 w-4 text-[#ff1493]" />
                {event.venue_name}
              </span>
            </div>
          </div>

          <div className="glass-panel self-end rounded-lg p-5">
            <p className="text-sm font-bold uppercase text-[#ff1493]">Resumo premium</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <MiniStat icon={<Users className="h-4 w-4" />} label="Disponíveis" value={String(remainingTickets)} />
              <MiniStat icon={<Music2 className="h-4 w-4" />} label="Line-up" value="Live" />
              <MiniStat icon={<ShieldCheck className="h-4 w-4" />} label="Entrada" value="QR" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_420px] lg:px-6">
        <div className="grid content-start gap-6">
          <div className="glass-panel rounded-lg p-6">
            <p className="flex items-center gap-2 text-sm font-black uppercase text-[#ff1493]">
              <Sparkles className="h-4 w-4" />
              Sobre o evento
            </p>
            <p className="mt-4 whitespace-pre-line text-lg leading-8 text-white/68">
              {event.description ?? "Informacoes completas serao adicionadas pelo organizador."}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <InfoPanel title="Local" text={`${event.venue_name} - ${event.address}`} />
            <InfoPanel title="Organizador" text={event.organizers?.trade_name ?? "TicketFly"} />
          </div>
        </div>

        <CheckoutForm
          batches={activeBatches}
          demoMode={demoMode}
          feeContract={feeContract}
          initialPromoterCode={query.ref?.trim() ?? ""}
          initialCouponCode={query.cupom?.trim() ?? ""}
          initialBuyerName={buyerName}
          initialBuyerEmail={buyerEmail}
          paymentProvider={paymentProvider}
        />
      </section>
    </main>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/24 p-3">
      <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#ff1493]/12 text-[#ff1493]">{icon}</div>
      <strong className="mt-2 block text-white">{value}</strong>
      <span className="text-xs text-white/46">{label}</span>
    </div>
  );
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111014] p-5">
      <h3 className="font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/58">{text}</p>
    </div>
  );
}
