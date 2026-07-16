import Link from "next/link";
import { AtSign, Camera, Music2, Radio, Send, Ticket } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#050505] text-[#f8f4f7]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#050505]/72 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-[#ff1493]/40 bg-[#ff1493]/12 shadow-[0_0_28px_rgba(255,20,147,0.25)]">
              <Ticket className="h-5 w-5 text-[#ff1493]" />
            </span>
            <span className="text-xl font-black text-white">
              Ticket<span className="text-[#ff1493]">Fly</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-white/68 md:flex">
            <Link className="transition hover:text-white" href="/eventos">
              Eventos
            </Link>
            <Link className="transition hover:text-white" href="/eventos?categoria=shows">
              Shows
            </Link>
            <Link className="transition hover:text-white" href="/eventos?categoria=festivais">
              Festivais
            </Link>
            <Link className="transition hover:text-white" href="/eventos?categoria=vip">
              Ingressos VIP
            </Link>
            <Link className="transition hover:text-white" href="/painel">
              Painel
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link className="hidden rounded-full px-4 py-2 text-sm font-bold text-white/75 transition hover:text-white sm:inline-flex" href="/login">
              Login
            </Link>
            <Link className="neon-button rounded-full px-4 py-2 text-sm font-black" href="/eventos">
              Comprar Agora
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/10 bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr_1fr] lg:px-6">
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
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-[#ff1493]/60 hover:text-[#ff1493]"
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
