import Link from "next/link";
import { CalendarDays, MapPin, QrCode, Ticket as TicketIcon } from "lucide-react";

import { Badge, type BadgeVariant } from "@/components/badge";
import { WalletButton } from "@/components/wallet-button";
import type { WalletTicket } from "@/lib/ticketfly-data";

const TIER_BADGE: Record<WalletTicket["tier"], BadgeVariant> = {
  VIP: "vip",
  Pista: "pista",
  Camarote: "camarote",
};

function formatDayParts(iso: string) {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "").toUpperCase(),
    time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date),
    full: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(date),
  };
}

function inferTier(name: string): WalletTicket["tier"] {
  const lower = name.toLowerCase();
  if (lower.includes("vip")) return "VIP";
  if (lower.includes("camarote") || lower.includes("sky")) return "Camarote";
  return "Pista";
}

export function TicketCard({ ticket }: { ticket: WalletTicket }) {
  const when = formatDayParts(ticket.starts_at);
  const tier = ticket.tier || inferTier(ticket.title);
  const ticketHref = ticket.accessToken
    ? `/ingressos/${ticket.code}?access=${encodeURIComponent(ticket.accessToken)}`
    : `/ingressos/${ticket.code}`;

  return (
    <article className="surface lift group overflow-hidden rounded-[22px]">
      <div className="grid lg:grid-cols-[1fr_168px]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
          <div className="relative h-40 shrink-0 overflow-hidden rounded-2xl sm:h-32 sm:w-32">
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url(${ticket.cover_image_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute left-2.5 top-2.5 flex flex-col items-center rounded-xl border border-white/15 bg-black/55 px-2.5 py-1.5 text-center backdrop-blur-md">
              <span className="text-lg font-bold leading-none text-white">{when.day}</span>
              <span className="text-[0.62rem] font-semibold tracking-wide text-white/70">{when.month}</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-white">{ticket.title}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/55">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#ff1493]" aria-hidden />
                {when.full} · {when.time}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/55">
                <MapPin className="h-4 w-4 shrink-0 text-[#ff1493]" aria-hidden />
                <span className="truncate">
                  {ticket.venue_name} · {ticket.city}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={TIER_BADGE[tier]}>{tier}</Badge>
              {ticket.qrReady ? <Badge variant="qr">QR disponível</Badge> : null}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-1">
              <Link href={ticketHref} className="neon-button btn h-11 px-5 text-sm">
                <TicketIcon className="h-4 w-4" aria-hidden />
                Abrir ingresso
              </Link>
              {ticket.qrReady ? (
                <WalletButton code={ticket.code} accessToken={ticket.accessToken} label="Adicionar à Wallet" />
              ) : null}
            </div>
          </div>
        </div>

        <Link
          href={ticketHref}
          className="relative flex items-center justify-center gap-3 border-t border-dashed border-white/14 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04] lg:flex-col lg:border-l lg:border-t-0"
        >
          <div className="grid h-16 w-16 place-items-center rounded-xl border border-white/12 bg-white/[0.04]">
            <QrCode className="h-8 w-8 text-white/80" aria-hidden />
          </div>
          <div className="text-left lg:text-center">
            <p className="text-sm font-semibold text-white">
              {ticket.qrReady ? "Abrir QR dinâmico" : "Ingresso"}
            </p>
            <p className="font-mono text-xs text-white/45">{ticket.code.slice(0, 8).toUpperCase()}</p>
          </div>
        </Link>
      </div>
    </article>
  );
}
