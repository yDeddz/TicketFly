"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/eventos", label: "Eventos" },
  { href: "/eventos?categoria=shows", label: "Shows" },
  { href: "/eventos?categoria=festivais", label: "Festivais" },
  { href: "/parceiros", label: "Parceiros" },
  { href: "/ajuda", label: "Ajuda" },
  { href: "/checkin", label: "Check-in" },
];

export function MobileNav({ extraLinks = [] }: { extraLinks?: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/75 transition hover:border-[#ff1493]/35 hover:text-white sm:h-10 sm:w-10"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="fixed inset-x-0 top-[4.25rem] z-40 border-b border-white/10 bg-[#050505]/95 px-4 py-4 backdrop-blur-2xl">
          <nav className="mx-auto grid max-w-7xl gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.04] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {extraLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-[#ffb1d5] transition hover:bg-white/[0.04] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/eventos"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-[#ff1493] text-sm font-bold text-white"
            >
              Comprar agora
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
