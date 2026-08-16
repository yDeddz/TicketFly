import Link from "next/link";
import { AtSign, Camera, CirclePlus, Music2, Radio, Send } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { MobileNav } from "@/components/mobile-nav";
import { TicketsNavButton } from "@/components/tickets-nav-button";
import { UserMenu } from "@/components/user-menu";
import { hasSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const HEADER_OFFSET = "4.25rem";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let userSummary: {
    id: string;
    email: string;
    fullName: string | null;
    role: string | null;
  } | null = null;
  let ticketCount = 0;

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

        const { count } = await supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .or(`buyer_user_id.eq.${user.id},buyer_email.eq.${user.email}`)
          .in("status", ["paid", "used", "pending"]);

        ticketCount = count ?? 0;
      }
    } catch {
      userSummary = null;
      ticketCount = 0;
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#050505] text-[#f8f4f7]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#050505]/75 backdrop-blur-2xl">
        <div className="relative mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav
              extraLinks={[
                ...(userSummary?.role === "organizer" || userSummary?.role === "admin"
                  ? [{ href: "/organizador", label: "Painel organizador" }]
                  : []),
                ...(userSummary?.role === "admin" ? [{ href: "/admin", label: "Administração" }] : []),
                ...(userSummary?.role === "admin" ||
                userSummary?.role === "organizer" ||
                userSummary?.role === "checkin"
                  ? [{ href: "/checkin", label: "Check-in da porta" }]
                  : []),
              ]}
            />
            <BrandLogo className="max-w-[9.5rem] sm:max-w-[11.5rem]" priority variant="horizontal" />
          </div>

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
              aria-label="Criar evento"
              className="group inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/75 transition-colors duration-200 hover:border-[#ff1493]/35 hover:bg-[#ff1493]/10 hover:text-white sm:h-10 sm:w-10 lg:h-10 lg:w-auto lg:gap-2 lg:px-3 lg:text-xs lg:font-semibold"
              href="/parceiros#candidatura"
            >
              <CirclePlus className="h-4 w-4 text-white/55 transition-colors group-hover:text-[#ff9ed2] sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={1.75} />
              <span className="hidden lg:inline">Criar evento</span>
            </Link>
            <TicketsNavButton count={ticketCount} />
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
            <BrandLogo className="max-w-[11rem] sm:max-w-[13rem]" variant="stacked" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/58">
              Tecnologia para criar, divulgar, vender e gerenciar eventos com mais eficiência, oferecendo uma experiência completa para organizadores, promoters e participantes.
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
            <Link className="hover:text-white" href="/ajuda">
              Central de Ajuda
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
