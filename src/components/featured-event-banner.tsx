import Link from "next/link";
import { ArrowRight, CalendarDays, Ticket, Zap } from "lucide-react";

/** Instagram-style club banners: 4:5 (feed) or 9:16 (story/reels). */
export type BannerAspect = "4/5" | "9/16" | "3/4";

const ASPECT_RATIO: Record<BannerAspect, number> = {
  "4/5": 4 / 5,
  "9/16": 9 / 16,
  "3/4": 3 / 4,
};

type FeaturedEventBannerProps = {
  imageUrl: string;
  title: string;
  href: string;
  dateLabel: string;
  lotsLabel: string;
  priceLabel: string;
  /** Default 4:5 — common club flyer / Instagram feed. */
  aspect?: BannerAspect;
  /** Cap height so 9:16 doesn't eat the whole viewport. */
  maxVh?: number;
  badge?: string;
  eyebrow?: string;
};

export function FeaturedEventBanner({
  imageUrl,
  title,
  href,
  dateLabel,
  lotsLabel,
  priceLabel,
  aspect = "4/5",
  maxVh = 68,
  badge = "Ingressos à venda",
  eyebrow = "Em destaque",
}: FeaturedEventBannerProps) {
  const ratio = ASPECT_RATIO[aspect];

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_24px_80px_-40px_rgba(255,20,147,0.45)] sm:rounded-[22px]"
      style={{
        aspectRatio: aspect.replace("/", " / "),
        maxHeight: `min(${maxVh}svh, 40rem)`,
        // When max-height wins (tall 9:16 on short phones), shrink width so the box keeps the poster ratio.
        width: `min(100%, calc(min(${maxVh}svh, 40rem) * ${ratio}))`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote event covers vary by organizer */}
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10"
      />

      <div className="absolute inset-x-3 top-3 flex items-center justify-between sm:inset-x-4 sm:top-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff1493]/95 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white shadow-[0_8px_24px_-10px_rgba(255,20,147,0.9)] sm:px-3 sm:text-[0.7rem]">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
          {badge}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 grid gap-2.5 p-3.5 pt-16 sm:gap-3 sm:p-4 sm:pt-20">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-white/55 sm:text-xs">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 line-clamp-2 text-xl font-bold tracking-tight text-white sm:mt-1 sm:text-2xl">
            {title}
          </h2>
        </div>

        {/* Compact meta on narrow phones; cards from sm up */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-white/65 sm:hidden">
          <span className="inline-flex items-center gap-1 font-semibold text-white">
            <CalendarDays className="h-3.5 w-3.5 text-[#ff9ed2]" />
            {dateLabel}
          </span>
          <span className="text-white/30">·</span>
          <span className="inline-flex items-center gap-1">
            <Ticket className="h-3.5 w-3.5 text-[#ff9ed2]" />
            {lotsLabel}
          </span>
          <span className="text-white/30">·</span>
          <span className="inline-flex items-center gap-1 font-semibold text-white">
            <Zap className="h-3.5 w-3.5 text-[#ff9ed2]" />
            {priceLabel}
          </span>
        </div>

        <div className="hidden grid-cols-3 gap-2 text-center text-xs text-white/55 sm:grid">
          <Metric icon={<CalendarDays className="h-4 w-4" />} label="Data" value={dateLabel} />
          <Metric icon={<Ticket className="h-4 w-4" />} label="Lotes" value={lotsLabel} />
          <Metric icon={<Zap className="h-4 w-4" />} label="A partir de" value={priceLabel} />
        </div>

        <Link href={href} className="neon-button btn h-10 w-full text-sm sm:h-11">
          Comprar ingresso
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-md">
      <div className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-lg bg-[#ff1493]/10 text-[#ff9ed2]">
        {icon}
      </div>
      <strong className="block truncate text-base font-semibold text-white">{value}</strong>
      <span className="truncate">{label}</span>
    </div>
  );
}
