import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, Radio, ShieldCheck, Sparkles, Ticket, Zap } from "lucide-react";

import { EventCard } from "@/components/event-card";
import { hasSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { showcaseEvents } from "@/lib/ticketfly-data";
import type { EventWithBatches } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function Home() {
  let events: EventWithBatches[] = [];

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("events")
      .select("*, organizers(trade_name), ticket_batches(*)")
      .eq("status", "published")
      .order("starts_at", { ascending: true })
      .limit(6);

    events = (data ?? []) as EventWithBatches[];
  }

  const featured = events.length ? events : showcaseEvents;

  return (
    <main className="ticket-grid">
      <section className="relative min-h-[92vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(5,5,5,0.96) 0%, rgba(5,5,5,0.72) 38%, rgba(255,20,147,0.08) 100%), linear-gradient(180deg, rgba(5,5,5,0.16), #050505 96%), url(https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=2200&q=85)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-32 md:grid-cols-[1.05fr_0.95fr] md:items-end lg:px-6 lg:pt-40">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#ff1493]/35 bg-[#ff1493]/10 px-4 py-2 text-xs font-black uppercase text-[#ff7ec8] backdrop-blur-md">
              <span className="live-dot h-2 w-2 rounded-full bg-[#ff1493]" />
              Eventos premium em tempo real
            </p>
            <h1 className="mt-6 text-5xl font-black leading-[0.95] text-white md:text-7xl">
              TicketFly
              <span className="block text-[#ff1493] drop-shadow-[0_0_24px_rgba(255,20,147,0.42)]">
                venda noites inesqueciveis.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
              Plataforma de bilheteria online com visual cyberpunk elegante, checkout de alta conversao e ingressos digitais para shows, festivais e experiencias VIP.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="neon-button inline-flex min-h-[3.25rem] items-center gap-2 rounded-full px-6 font-black" href="/eventos">
                Comprar Agora
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className="ghost-button inline-flex min-h-[3.25rem] items-center gap-2 rounded-full px-6 font-bold" href="/checkout">
                Ver Checkout
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-lg p-4">
            <div className="relative overflow-hidden rounded-lg">
              <div
                className="h-[26rem] bg-cover bg-center"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(5,5,5,0.05), rgba(5,5,5,0.82)), url(https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=85)",
                }}
              />
              <div className="absolute inset-x-4 bottom-4 grid gap-3 rounded-lg border border-white/10 bg-black/54 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#ff1493] px-3 py-1 text-xs font-black uppercase text-white">Live</span>
                  <span className="text-sm font-bold text-white/70">Hoje na TicketFly</span>
                </div>
                <h2 className="text-2xl font-black">Neon Pulse Festival</h2>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/58">
                  <Metric icon={<Ticket className="h-4 w-4" />} label="Vendas" value="+18k" />
                  <Metric icon={<Zap className="h-4 w-4" />} label="Conversao" value="4.8x" />
                  <Metric icon={<Radio className="h-4 w-4" />} label="Ao vivo" value="24h" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-4 lg:px-6">
        <Feature icon={<Sparkles className="h-5 w-5" />} title="Experiencia premium" text="Glassmorphism, glow neon e leitura rapida." />
        <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Compra confiavel" text="Checkout claro, seguro e orientado a conversao." />
        <Feature icon={<CalendarDays className="h-5 w-5" />} title="Eventos vivos" text="Indicadores de status, lotes e urgencia." />
        <Feature icon={<BadgeCheck className="h-5 w-5" />} title="Ingresso digital" text="QR Code unico para entrada sem atrito." />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-[#ff1493]">Eventos em destaque</p>
            <h2 className="mt-2 text-3xl font-black md:text-5xl">Escolha sua proxima experiencia</h2>
          </div>
          <Link className="ghost-button rounded-full px-5 py-3 text-sm font-bold" href="/eventos">
            Ver todos
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.slice(0, 3).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="glass-panel rounded-lg p-5">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ff1493]/12 text-[#ff1493]">{icon}</div>
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/56">{text}</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full bg-[#ff1493]/12 text-[#ff1493]">{icon}</div>
      <strong className="block text-base text-white">{value}</strong>
      <span>{label}</span>
    </div>
  );
}
