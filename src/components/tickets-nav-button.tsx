"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket } from "lucide-react";
import clsx from "clsx";

export function TicketsNavButton({ count }: { count: number }) {
  const pathname = usePathname();
  const active = pathname === "/painel";

  return (
    <Link
      href="/painel"
      aria-label={count > 0 ? `Meus ingressos (${count})` : "Meus ingressos"}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group relative inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border px-2.5 text-sm font-semibold backdrop-blur-md transition-all duration-200 sm:h-10 sm:px-3 md:px-3.5",
        active
          ? "border-[#ff1493]/50 bg-[#ff1493]/12 text-white shadow-[0_8px_30px_-12px_rgba(255,20,147,0.6)]"
          : "border-white/12 bg-white/[0.04] text-white/80 hover:border-[#ff1493]/40 hover:bg-[#ff1493]/8 hover:text-white",
      )}
    >
      <Ticket
        className={clsx(
          "h-4 w-4 transition-colors",
          active ? "text-[#ff1493]" : "text-white/70 group-hover:text-[#ff1493]",
        )}
        aria-hidden
      />
      <span className="hidden md:inline">Meus Ingressos</span>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-w-[1.15rem] place-items-center rounded-full bg-[#ff1493] px-1 text-[0.65rem] font-bold leading-4 text-white md:static md:min-w-[1.25rem] md:px-1.5 md:text-[0.7rem] md:leading-5">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
