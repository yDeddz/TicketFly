import type { LucideIcon } from "lucide-react";
import { Crown, Heart, QrCode, Radio, Sparkles, Star, Users } from "lucide-react";
import clsx from "clsx";

export type BadgeVariant = "qr" | "vip" | "pista" | "camarote" | "live" | "new" | "favorite" | "neutral";

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: LucideIcon | null;
  className?: string;
};

const VARIANTS: Record<
  BadgeVariant,
  { icon: LucideIcon | null; className: string; live?: boolean }
> = {
  qr: {
    icon: QrCode,
    className: "border-[#ff1493]/25 bg-[#ff1493]/10 text-[#ff9ed2]",
  },
  vip: {
    icon: Crown,
    className: "border-[#ffcf5c]/30 bg-[#ffcf5c]/10 text-[#ffe4a3]",
  },
  camarote: {
    icon: Sparkles,
    className: "border-[#c78bff]/30 bg-[#c78bff]/10 text-[#e2c8ff]",
  },
  pista: {
    icon: Users,
    className: "border-white/14 bg-white/[0.05] text-white/80",
  },
  live: {
    icon: null,
    className: "border-[#ff1493]/30 bg-[#ff1493]/12 text-[#ff9ed2]",
    live: true,
  },
  new: {
    icon: Star,
    className: "border-[#5cffb0]/25 bg-[#5cffb0]/10 text-[#b6ffdb]",
  },
  favorite: {
    icon: Heart,
    className: "border-[#ff1493]/25 bg-[#ff1493]/10 text-[#ff9ed2]",
  },
  neutral: {
    icon: null,
    className: "border-white/12 bg-white/[0.04] text-white/70",
  },
};

export function Badge({ variant = "neutral", children, icon, className }: BadgeProps) {
  const config = VARIANTS[variant];
  const Icon = icon === undefined ? config.icon : icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide backdrop-blur-md",
        config.className,
        className,
      )}
    >
      {config.live ? (
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#ff1493]" aria-hidden />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
