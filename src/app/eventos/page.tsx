import Link from "next/link";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { EventCard } from "@/components/event-card";
import { hasSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { showcaseEvents } from "@/lib/ticketfly-data";
import type { EventWithBatches } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  let events: EventWithBatches[] = [];

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("events")
      .select("*, organizers(trade_name), ticket_batches(*)")
      .eq("status", "published")
      .order("starts_at", { ascending: true });

    events = (data ?? []) as EventWithBatches[];
  }

  const source = events.length ? events : showcaseEvents;
  const filtered =
    categoria === "vip"
      ? source.filter((event) => event.title.toLowerCase().includes("vip") || event.slug.includes("vip"))
      : categoria === "festivais"
        ? source.filter((event) => event.title.toLowerCase().includes("festival"))
        : categoria === "shows"
          ? source.filter((event) => !event.title.toLowerCase().includes("festival") && !event.slug.includes("vip"))
          : source;

  return (
    <main className="ticket-grid px-4 pb-16 pt-28 lg:px-6">
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#ff1493]/35 bg-[#ff1493]/10 px-4 py-2 text-xs font-black uppercase text-[#ff7ec8]">
              <Sparkles className="h-4 w-4" />
              TicketFly Events
            </p>
            <h1 className="mt-5 text-4xl font-black md:text-6xl">Eventos, shows e festivais em destaque</h1>
            <p className="mt-4 max-w-2xl text-white/62">
              Curadoria premium com lotes ativos, experiencias VIP e compra digital em poucos passos.
            </p>
          </div>

          <div className="glass-panel rounded-lg p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#ff1493]" />
                <input
                  className="h-12 w-full rounded-lg border border-white/10 bg-black/28 pl-11 pr-4 outline-none transition focus:border-[#ff1493]/70"
                  placeholder="Buscar eventos"
                />
              </label>
              <button className="ghost-button inline-flex h-12 items-center justify-center gap-2 rounded-lg px-4 font-bold">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
              <Filter href="/eventos" active={!categoria} label="Todos" />
              <Filter href="/eventos?categoria=shows" active={categoria === "shows"} label="Shows" />
              <Filter href="/eventos?categoria=festivais" active={categoria === "festivais"} label="Festivais" />
              <Filter href="/eventos?categoria=vip" active={categoria === "vip"} label="VIP" />
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </main>
  );
}

function Filter({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      className={`rounded-full px-4 py-2 transition ${
        active ? "bg-[#ff1493] text-white shadow-[0_0_24px_rgba(255,20,147,0.35)]" : "bg-white/[0.05] text-white/62 hover:text-white"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}
