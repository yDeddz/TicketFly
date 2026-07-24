import Link from "next/link";
import { AtSign, Camera, CirclePlus, Music2, Radio, Send, Ticket } from "lucide-react";

import { TicketsNavButton } from "@/components/tickets-nav-button";
import { UserMenu } from "@/components/user-menu";
import { hasSupabaseConfig } from "@/lib/env";
import { myTickets } from "@/lib/ticketfly-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const HEADER_OFFSET = "4.25rem";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let userSummary: {
    id: string;
    email: string;
    fullName: string | null;
    role: string | null;
  } | null = null;

  if (hasSupabaseConfig()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const { data: profile } = await supabase
          .from("users")
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle();

        userSummary = {
          id: user.id,
          email: user.email,
          fullName:
            profile?.full_name ??
            (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
            (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null),
          role: profile?.role ?? null,
        };
      }
    } catch {
      userSummary = null;
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#050505] text-[#f8f4f7]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#050505]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-5 lg:px-6">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#ff1493]/35 bg-[#ff1493]/10 shadow-[0_8px_24px_-10px_rgba(255,20,147,0.5)] sm:h-10 sm:w-10 sm:rounded-2xl">
              <Ticket className="h-4 w-4 text-[#ff1493] sm:h-5 sm:w-5" />
            </span>
            <span className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">
              Ticket<span className="text-[#ff1493]">Fly</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-white/65 xl:flex">
            <Link className="transition-colors duration-200 hover:text-white" href="/eventos">
              Eventos
            </Link>
            <Link className="transition-colors duration-200 hover:text-white" href="/eventos?categoria=shows">
              Shows
            </Link>
            <Link className="transition-colors duration-200 hover:text-white" href="/eventos?categoria=festivais">
              Festivais
            </Link>
          </nav>

          <div className="flex min-w-0 shrink items-center justify-end gap-1.5 sm:gap-2">
            <Link
              className="group inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 text-[0.7rem] font-semibold text-white/75 transition-colors duration-200 hover:border-[#ff1493]/35 hover:bg-[#ff1493]/10 hover:text-white sm:h-10 sm:gap-2 sm:px-3 sm:text-xs"
              href="/parceiros#candidatura"
            >
              <CirclePlus className="h-4 w-4 text-white/55 transition-colors group-hover:text-[#ff9ed2] sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={1.75} />
              Criar evento
            </Link>
            <TicketsNavButton count={myTickets.length} />
            <UserMenu user={userSummary} />
            <Link
              className="neon-button btn hidden h-10 shrink-0 cursor-pointer px-4 text-sm lg:inline-flex"
              href="/eventos"
            >
              Comprar Agora
            </Link>
          </div>
        </div>
      </header>
      <div style={{ paddingTop: HEADER_OFFSET }}>{children}</div>
      <footer className="border-t border-white/10 bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-5 md:grid-cols-[1.2fr_1fr_1fr] lg:px-6">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff1493]/14">
                <Ticket className="h-5 w-5 text-[#ff1493]" />
              </span>
              <span className="text-lg font-black">TicketFly</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/58">
              Tecnologia de bilheteria para eventos com venda rapida, checkout premium e ingresso digital inteligente.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-white/64">
            <strong className="text-white">Plataforma</strong>
            <Link className="hover:text-white" href="/eventos">
              Eventos
            </Link>
            <Link className="hover:text-white" href="/parceiros">
              Quero ser parceiro
            </Link>
            <Link className="hover:text-white" href="/parceiros#candidatura">
              Criar evento
            </Link>
            <Link className="hover:text-white" href="/checkout">
              Checkout
            </Link>
            <Link className="hover:text-white" href="/checkin">
              Check-in
            </Link>
          </div>
          <div>
            <strong className="text-sm text-white">Social</strong>
            <div className="mt-4 flex gap-3">
              {[Camera, Send, Music2, Radio, AtSign].map((Icon, index) => (
                <Link
                  aria-label={`Rede social ${index + 1}`}
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition duration-200 hover:border-[#ff1493]/60 hover:text-[#ff1493]"
                  href="/"
                  key={index}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
