import Link from "next/link";
import { notFound } from "next/navigation";

import { TicketQrLive } from "@/components/ticket-qr-live";
import { WalletButton } from "@/components/wallet-button";
import { formatDateTime } from "@/lib/format";
import {
  authorizeTicketAccess,
  loadTicketByCode,
  unwrapRelation,
} from "@/lib/ticket-access";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { code } = await params;
  const { access } = await searchParams;
  const ticket = await loadTicketByCode(code);

  if (!ticket) {
    notFound();
  }

  const auth = await authorizeTicketAccess({ ticket, accessToken: access });

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-10 pt-8">
        <section className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-6 shadow-sm shadow-[#ff1493]/10">
          <p className="text-sm font-bold uppercase text-[#ff1493]">Ingresso protegido</p>
          <h1 className="mt-2 text-2xl font-black text-white">Acesso restrito</h1>
          <p className="mt-3 text-sm text-[#c9aabc]">
            Entre com a conta da compra ou abra o link seguro enviado após o pagamento para ver o QR.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/ingressos/${code}`)}`}
            className="mt-6 inline-flex rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white"
          >
            Fazer login
          </Link>
        </section>
      </main>
    );
  }

  const event = unwrapRelation(ticket.events);
  const batch = unwrapRelation(ticket.ticket_batches);

  return (
    <main className="mx-auto max-w-lg px-4 pb-10 pt-8">
      <section className="overflow-hidden rounded-lg border border-[#ff1493]/30 bg-[#120410] shadow-sm shadow-[#ff1493]/10">
        <div className="bg-[#090008] p-5 text-white">
          <p className="text-sm font-bold uppercase text-[#ff1493]">Ingresso TicketFly</p>
          <h1 className="mt-2 text-2xl font-black">{event?.title}</h1>
          <p className="mt-2 text-white/75">{event?.starts_at ? formatDateTime(event.starts_at) : ""}</p>
          {event?.venue_name ? <p className="mt-1 text-sm text-white/55">{event.venue_name}</p> : null}
        </div>
        <div className="grid gap-4 p-5">
          <div>
            <p className="text-sm text-[#c9aabc]">Participante</p>
            <strong>{ticket.buyer_name}</strong>
            <p className="text-sm text-[#c9aabc]">{ticket.buyer_email}</p>
          </div>
          <div>
            <p className="text-sm text-[#c9aabc]">Lote</p>
            <strong>{batch?.name}</strong>
          </div>

          {ticket.status === "paid" ? (
            <TicketQrLive code={ticket.code} accessToken={access} initialStatus={ticket.status} />
          ) : (
            <div className="rounded-md border border-[#f5a524]/50 bg-[#261802] p-4 text-sm font-medium text-[#ffd27a]">
              QR Code indisponível. Status atual: {ticket.status}.
            </div>
          )}

          {ticket.status === "paid" ? (
            <WalletButton code={ticket.code} accessToken={access} className="w-full [&_button]:w-full [&_button]:justify-center" />
          ) : null}

          <p className="break-all rounded-md bg-[#210018] p-3 text-center font-mono text-xs text-[#ffb1d5]">
            Ref. {ticket.code}
          </p>
          <p className="text-center text-[11px] text-[#c9aabc]/80">
            A referência pública não libera entrada. Somente o QR dinâmico ou o pass da Wallet.
          </p>
        </div>
      </section>
    </main>
  );
}
