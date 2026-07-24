import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

type UpcomingEventData = {
  slug: string;
  title: string;
  starts_at: string;
  city: string;
};

function formatShort(iso: string) {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "").toUpperCase(),
    label: new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

export function UpcomingEvent({ event }: { event: UpcomingEventData }) {
  const when = formatShort(event.starts_at);

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="surface-soft lift group flex items-center gap-4 rounded-2xl p-3.5"
    >
      <div className="grid h-14 w-14 shrink-0 flex-col place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-center">
        <span className="text-lg font-bold leading-none text-white">{when.day}</span>
        <span className="text-[0.6rem] font-semibold tracking-wide text-white/60">{when.month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">{event.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/50">
          <CalendarDays className="h-3.5 w-3.5 text-[#ff1493]" aria-hidden />
          {when.label} · {event.city}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/30 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white/60" aria-hidden />
    </Link>
  );
}
