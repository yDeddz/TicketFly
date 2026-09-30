"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote,
  CalendarDays,
  DoorOpen,
  LayoutDashboard,
  Menu,
  Percent,
  QrCode,
  RotateCcw,
  ScanLine,
  Ticket,
  UserRound,
  Users,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";

import { BrandLogo } from "@/components/brand-logo";

const NAV: { href: string; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { href: "/organizador", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organizador/perfil", label: "Perfil", icon: UserRound },
  { href: "/organizador/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/organizador/promotores", label: "Promotores", icon: Users },
  { href: "/organizador/cupons", label: "Cupons", icon: Ticket },
  { href: "/organizador/vendas-na-entrada", label: "Bilheteria na Porta", icon: DoorOpen, soon: true },
  { href: "/organizador/ingressos", label: "Ingressos / QR", icon: QrCode },
  { href: "/organizador/entradas", label: "Gestão de entrada", icon: ScanLine },
  { href: "/organizador/pagamentos", label: "Pagamentos", icon: Banknote },
  { href: "/organizador/taxas", label: "Taxas", icon: Percent },
  { href: "/organizador/reembolsos", label: "Reembolsos", icon: RotateCcw },
  { href: "/organizador/webhooks", label: "Webhooks", icon: Webhook },
];

function isActive(pathname: string, href: string) {
  return href === "/organizador" ? pathname === href : pathname.startsWith(href);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="grid gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                active ? "bg-white/[0.06] font-medium text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <Icon className={clsx("h-4 w-4 shrink-0", active ? "text-[#ff5cb8]" : "text-white/35")} strokeWidth={1.75} />
              <span className="min-w-0 flex-1 leading-5">{item.label}</span>
              {item.soon ? (
                <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[#ff7ec8]">
                  Em breve
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BrandBlock({ tradeName }: { tradeName: string }) {
  return (
    <div className="px-4 pb-3 pt-5">
      <BrandLogo href="/" variant="horizontal" />
      <p className="mt-4 truncate text-sm font-semibold text-white" title={tradeName}>
        {tradeName}
      </p>
    </div>
  );
}

export function OrganizerShell({
  tradeName,
  profileIncomplete,
  children,
}: {
  tradeName: string;
  profileIncomplete: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed inset-x-0 bottom-0 top-[4.25rem] z-30 flex bg-[#050505] text-[#f8f4f7]">
      <aside className="hidden min-h-0 w-72 shrink-0 flex-col border-r border-white/10 lg:flex">
        <BrandBlock tradeName={tradeName} />
        <nav aria-label="Painel do organizador" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          <NavLinks pathname={pathname} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4 lg:hidden">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="organizer-nav"
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:bg-white/[0.06]"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir navegação</span>
          </button>
          <p className="truncate text-sm font-semibold">{tradeName}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {profileIncomplete ? (
              <p className="mb-6 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Complete documento, endereço e telefone em{" "}
                <Link href="/organizador/perfil" className="font-semibold underline">
                  Perfil
                </Link>
                .
              </p>
            ) : null}
            {children}
          </div>
        </div>
      </div>

      {open ? (
        <div className="absolute inset-0 z-20 lg:hidden">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div id="organizer-nav" className="relative flex h-full w-72 max-w-[85%] flex-col border-r border-white/10 bg-[#050505]">
            <div className="flex items-start justify-between gap-2 pr-2">
              <BrandBlock tradeName={tradeName} />
              <button
                type="button"
                aria-label="Fechar navegação"
                onClick={() => setOpen(false)}
                className="mt-4 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/[0.06]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Painel do organizador" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
