"use client";

import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Shield,
  Ticket,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthUserSummary = {
  id: string;
  email: string;
  fullName: string | null;
  role: string | null;
};

function initialsFrom(user: AuthUserSummary) {
  const source = user.fullName?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "T") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "F");
  return letters.toUpperCase().slice(0, 2);
}

export function UserMenu({ user }: { user: AuthUserSummary | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!user) {
    return (
      <Link
        aria-label="Login"
        className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-sm font-semibold text-white/80 transition-colors duration-200 hover:border-[#ff1493]/40 hover:bg-[#ff1493]/8 hover:text-white sm:h-10 sm:w-auto sm:gap-2 sm:px-3.5"
        href="/login"
      >
        <UserRound className="h-4 w-4 text-[#ff1493]" />
        <span className="hidden sm:inline">Login</span>
      </Link>
    );
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.replace("/");
    router.refresh();
  }

  const isAdmin = user.role === "admin";
  const isOrganizer = user.role === "organizer" || isAdmin;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu da conta"
        onClick={() => setOpen((current) => !current)}
        className="group inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] p-0.5 transition-colors duration-200 hover:border-[#ff1493]/45 hover:bg-[#ff1493]/10 sm:h-10 sm:gap-2 sm:py-1.5 sm:pl-1.5 sm:pr-2.5"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#ff1493] to-[#9d1160] text-[0.7rem] font-black text-white shadow-[0_8px_24px_-12px_rgba(255,20,147,0.9)] sm:h-9 sm:w-9 sm:text-xs">
          {initialsFrom(user)}
        </span>
        <span className="hidden max-w-[8rem] truncate text-sm font-semibold text-white/85 lg:inline">
          {user.fullName?.split(" ")[0] || user.email.split("@")[0]}
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 text-white/50 transition-transform duration-200 sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#120410]/95 p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl"
        >
          <div className="border-b border-white/8 px-3 py-3">
            <p className="truncate text-sm font-bold text-white">{user.fullName || "Conta TicketFly"}</p>
            <p className="truncate text-xs text-white/50">{user.email}</p>
          </div>

          <Link
            href="/painel"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
          >
            <Ticket className="h-4 w-4 text-[#ff1493]" />
            Meus ingressos
          </Link>

          {isOrganizer ? (
            <Link
              href="/organizador"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4 text-[#ff1493]" />
              Painel organizador
            </Link>
          ) : (
            <Link
              href="/parceiros"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4 text-[#ff1493]" />
              Quero ser parceiro
            </Link>
          )}

          {isAdmin ? (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              <Shield className="h-4 w-4 text-[#ff1493]" />
              Administração
            </Link>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4 text-[#ff1493]" />
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
