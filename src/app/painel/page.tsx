import Link from "next/link";
import { CalendarDays, CreditCard, Heart, QrCode, Ticket, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { showcaseEvents } from "@/lib/ticketfly-data";

export default function UserPanelPage() {
  const tickets = showcaseEvents.slice(0, 3);

  return (
    <main className="ticket-grid px-4 pb-16 pt-28 lg:px-6">
      <section className="mx-auto grid max-w-7xl gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-[#ff1493]">Painel do usuario</p>
            <h1 className="mt-2 text-4xl font-black md:text-6xl">Sua noite, organizada.</h1>
            <p className="mt-3 text-white/60">Ingressos, historico e experiencias VIP em um painel premium.</p>
          </div>
          <Link className="neon-button rounded-full px-5 py-3 text-sm font-black" href="/eventos">
            Comprar ingressos
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Ingressos ativos" value="3" tone="pink" />
          <StatCard label="Favoritos" value="12" />
          <StatCard label="Total investido" value={formatCurrency(71700)} tone="light" />
          <StatCard label="Status" value="VIP" tone="light" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="glass-panel rounded-lg p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">Meus ingressos</h2>
              <Ticket className="h-5 w-5 text-[#ff1493]" />
            </div>
            <div className="grid gap-3">
              {tickets.map((event) => (
                <Link
                  className="grid gap-4 rounded-lg border border-white/10 bg-black/24 p-4 transition hover:border-[#ff1493]/50 md:grid-cols-[88px_1fr_auto] md:items-center"
                  href={`/eventos/${event.slug}`}
                  key={event.id}
                >
                  <div
                    className="h-20 rounded-lg bg-cover bg-center"
                    style={{ backgroundImage: `url(${event.cover_image_url})` }}
                  />
                  <div>
                    <strong className="text-lg">{event.title}</strong>
                    <p className="mt-1 flex items-center gap-2 text-sm text-white/54">
                      <CalendarDays className="h-4 w-4 text-[#ff1493]" />
                      {formatDateTime(event.starts_at)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#ff1493]/12 px-4 py-2 text-sm font-bold text-[#ff8ac4]">
                    <QrCode className="h-4 w-4" />
                    QR ativo
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <aside className="grid gap-5">
            <Panel icon={<CreditCard className="h-5 w-5" />} title="Pagamentos" text="Cartao final 2026, Pix e recibos digitais." />
            <Panel icon={<Heart className="h-5 w-5" />} title="Favoritos" text="Alertas para festivais, shows e experiencias VIP." />
            <Panel icon={<TrendingUp className="h-5 w-5" />} title="Upgrade" text="Ofertas de lote e areas premium em tempo real." />
          </aside>
        </div>
      </section>
    </main>
  );
}

function Panel({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="glass-panel rounded-lg p-5">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ff1493]/12 text-[#ff1493]">{icon}</div>
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/56">{text}</p>
    </div>
  );
}
