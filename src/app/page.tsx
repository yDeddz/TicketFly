import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Music2,
  Percent,
  Ticket,
  Trophy,
} from "lucide-react";

import { EventCard } from "@/components/event-card";
import { FeatureGlowCards } from "@/components/feature-glow-cards";
import { FeaturedEventBanner } from "@/components/featured-event-banner";
import { SectionTitle } from "@/components/section-title";
import { HyperText } from "@/components/ui/hyper-text";
import { hasSupabaseConfig } from "@/lib/env";
import { formatCurrency } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { showcaseEvents } from "@/lib/ticketfly-data";
import type { EventWithBatches } from "@/types/domain";

const collections = [
  {
    label: "Promoções",
    href: "/eventos?categoria=promocoes",
    icon: Percent,
    accent: true,
  },
  {
    label: "Shows e Festas",
    href: "/eventos?categoria=shows",
    icon: Music2,
  },
  {
    label: "Esportes",
    href: "/eventos?categoria=esportes",
    icon: Trophy,
  },
  {
    label: "Teatros e Espetáculos",
    href: "/eventos?categoria=teatros",
    icon: Clapperboard,
  },
] as const;

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
  const hero = featured[0];
  const heroPrice = hero
    ? Math.min(...hero.ticket_batches.map((batch) => batch.price_cents), Number.POSITIVE_INFINITY)
    : Number.POSITIVE_INFINITY;
  const heroDate = hero
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
        .format(new Date(hero.starts_at))
        .replace(".", "")
    : "";
  const heroLots = hero?.ticket_batches
    .slice(0, 2)
    .map((batch) => batch.name)
    .join(" · ") || "Ingressos";

  return (
    <main className="ticket-grid overflow-x-clip">
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(5,5,5,0.96) 0%, rgba(5,5,5,0.72) 38%, rgba(255,20,147,0.08) 100%), linear-gradient(180deg, rgba(5,5,5,0.16), #050505 96%), url(https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=2200&q=85)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-8 sm:gap-10 sm:px-5 sm:pb-16 sm:pt-12 md:grid-cols-[1.05fr_0.95fr] md:gap-12 lg:gap-16 lg:px-6 lg:pb-20 lg:pt-16">
          <div className="min-w-0 max-w-2xl">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#ff1493]/25 bg-[#ff1493]/8 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[#ff9ed2] backdrop-blur-md sm:px-3.5 sm:py-1.5 sm:text-xs">
              <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff1493]" />
              <HyperText
                text="Voe mais alto. Viva experiencias"
                className="text-[0.65rem] font-semibold tracking-wide text-[#ff9ed2] sm:text-xs"
              />
            </p>

            <h1 className="mt-5 text-[clamp(1.85rem,1.1rem+3.6vw,4.25rem)] font-bold leading-[1.08] tracking-tight text-white sm:mt-6 sm:leading-[1.05]">
              Compre ingressos para{" "}
              <span className="bg-gradient-to-r from-[#ff1493] to-[#ff5cb8] bg-clip-text text-transparent sm:mt-1 sm:block">
                noites inesquecíveis.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-white/60 sm:mt-5 sm:text-base md:text-lg md:leading-relaxed">
              Shows, festivais e experiências VIP com ingresso digital, QR Code de entrada e pagamento seguro. Compre em
              segundos.
            </p>

            <div className="mt-6 flex w-full flex-col gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
              <Link
                className="neon-button btn h-11 w-full px-5 text-sm sm:h-12 sm:w-auto sm:min-w-[11.5rem] sm:px-6 sm:text-base"
                href="/eventos"
              >
                <Ticket className="h-4 w-4 shrink-0" />
                Comprar ingressos
              </Link>
              <Link
                className="ghost-button btn h-11 w-full px-5 text-sm font-semibold sm:h-12 sm:w-auto sm:px-6 sm:text-base"
                href="/eventos"
              >
                Explorar eventos
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-6">
              <span className="w-full text-xs text-white/45 sm:w-auto sm:text-sm">Buscar por:</span>
              {[
                { label: "Shows", href: "/eventos?categoria=shows" },
                { label: "Festivais", href: "/eventos?categoria=festivais" },
                { label: "Ingressos VIP", href: "/eventos?categoria=vip" },
              ].map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur-md transition-colors hover:border-[#ff1493]/40 hover:bg-[#ff1493]/8 hover:text-white sm:px-3.5 sm:text-sm"
                >
                  {chip.label}
                </Link>
              ))}
            </div>
          </div>

          {hero ? (
            <div className="flex min-w-0 justify-center md:justify-end">
              <FeaturedEventBanner
                imageUrl={
                  hero.cover_image_url ??
                  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1080&h=1350&q=85"
                }
                title={hero.title}
                href={`/eventos/${hero.slug}`}
                dateLabel={heroDate}
                lotsLabel={heroLots}
                priceLabel={Number.isFinite(heroPrice) ? formatCurrency(heroPrice) : "Em breve"}
                aspect="4/5"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-12 lg:px-6">
        <FeatureGlowCards />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8 lg:px-6">
        <div className="mb-4 sm:mb-5">
          <SectionTitle
            eyebrow="Explore"
            title="Nossas Coleções"
            description="Encontre o que você quer viver em poucos toques."
          />
        </div>

        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {collections.map((collection) => {
            const Icon = collection.icon;
            const isAccent = "accent" in collection && collection.accent;

            return (
              <Link
                key={collection.label}
                href={collection.href}
                className={
                  isAccent
                    ? "group inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full border border-[#ff1493]/25 bg-[#ff1493]/12 px-4 text-sm font-semibold text-[#ff9ed2] shadow-[0_8px_24px_-12px_rgba(255,20,147,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ff1493]/45 hover:bg-[#ff1493]/18 hover:text-white sm:h-[3.25rem] sm:px-5 sm:text-[0.95rem]"
                    : "group inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/80 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.65)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] hover:text-white sm:h-[3.25rem] sm:px-5 sm:text-[0.95rem]"
                }
              >
                <span
                  className={
                    isAccent
                      ? "grid h-8 w-8 place-items-center rounded-full bg-[#ff1493]/15 text-[#ff9ed2] transition-colors group-hover:bg-[#ff1493]/25 group-hover:text-white"
                      : "grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/70 transition-colors group-hover:bg-white/[0.1] group-hover:text-white"
                  }
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </span>
                {collection.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-5 sm:py-14 lg:px-6">
        <div className="mb-6 sm:mb-8">
          <SectionTitle
            eyebrow="Ingressos à venda"
            title="Escolha seu próximo evento"
            description="Compre ingressos para shows, festivais e experiências VIP."
            action={{ label: "Ver todos", href: "/eventos" }}
          />
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.slice(0, 3).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </main>
  );
}
