import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

type QuickActionProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
};

export function QuickAction({ icon: Icon, title, description, href }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="surface lift group flex items-center gap-4 rounded-2xl p-4"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#ff1493]/20 bg-[#ff1493]/10 text-[#ff9ed2]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-white">{title}</span>
        <span className="block truncate text-sm text-white/55">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white/70" aria-hidden />
    </Link>
  );
}
