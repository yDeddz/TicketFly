import Link from "next/link";
import { CalendarDays, MapPin, Ticket, Zap } from "lucide-react";

import { formatCurrency, formatDateTime } from "@/lib/format";
import type { EventWithBatches } from "@/types/domain";

export function EventCard({ event }: { event: EventWithBatches }) {
  const lowestPrice = Math.min(
    ...event.ticket_batches.map((batch) => batch.price_cents),
    Number.POSITIVE_INFINITY,
  );

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="group grid overflow-hidden rounded-lg border border-white/10 bg-[#111014]/86 shadow-[0_22px_70px_rgba(0,0,0,0.32)] transition duration-300 hover:-translate-y-1 hover:border-[#ff1493]/55 hover:shadow-[0_0_44px_rgba(255,20,147,0.18)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/4]">
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(5,5,5,0.02), rgba(5,5,5,0.82)), url(${event.cover_image_url ?? "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1080&h=1350&q=80"})`,
          }}
        />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-[#ff1493]/40 bg-black/58 px-3 py-1 text-xs font-black uppercase text-white backdrop-blur-md">
          <span className="live-dot h-2 w-2 rounded-full bg-[#ff1493]" />
          Ao vivo
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1 text-xs font-bold uppercase text-[#ff7ec8]">
              <Zap className="h-3.5 w-3.5" />
              {event.city}
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-white">{event.title}</h2>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ff1493] text-white shadow-[0_0_24px_rgba(255,20,147,0.5)]">
            <Ticket className="h-5 w-5" />
          </span>
        </div>
      </div>
      <div className="grid gap-4 p-5">
        <div className="grid gap-2 text-sm text-white/62">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#ff1493]" />
            {formatDateTime(event.starts_at)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#ff1493]" />
            {event.venue_name}
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
          <span className="text-sm text-white/50">a partir de</span>
          <strong className="text-xl text-white">
            {Number.isFinite(lowestPrice) ? formatCurrency(lowestPrice) : "Em breve"}
          </strong>
        </div>
        <span className="neon-button inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-black">
          Ver Ingressos
        </span>
      </div>
    </Link>
  );
}
