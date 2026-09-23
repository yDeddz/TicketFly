import Link from "next/link";
import { notFound } from "next/navigation";

import { TicketQrLive } from "@/components/ticket-qr-live";
import { WalletButton } from "@/components/wallet-button";
import { DownloadTicketButton } from "@/components/download-ticket-button";
import { SendTicketEmailButton } from "@/components/send-ticket-email-button";
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
            <TicketQrLive
              code={ticket.code}
              accessToken={access}
              initialStatus={ticket.status}
              buyerName={ticket.buyer_name}
            />
          ) : (
            <div className="rounded-md border border-[#f5a524]/50 bg-[#261802] p-4 text-sm font-medium text-[#ffd27a]">
              QR Code indisponível.{" "}
              {ticket.status === "used"
                ? "Este ingresso já foi usado na entrada."
                : ticket.status === "cancelled"
                  ? "Este ingresso foi cancelado ou reembolsado."
                  : ticket.status === "pending"
                    ? "Ele libera depois da confirmação do pagamento."
                    : "Tente novamente em instantes."}
            </div>
          )}

          {ticket.status === "paid" ? (
            <div className="grid gap-3">
              <DownloadTicketButton
                code={ticket.code}
                accessToken={access}
                className="w-full [&_button]:w-full [&_button]:justify-center"
              />
              <SendTicketEmailButton code={ticket.code} accessToken={access} />
              <WalletButton
                code={ticket.code}
                accessToken={access}
                className="w-full [&_button]:w-full [&_button]:justify-center"
              />
              <Link
                href="/painel"
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-bold text-white/80 hover:bg-white/5"
              >
                Ver no meu perfil
              </Link>
            </div>
          ) : null}

          <p className="break-all rounded-md bg-[#210018] p-3 text-center font-mono text-xs text-[#ffb1d5]">
            Ref. {ticket.code}
          </p>
          <p className="text-center text-[11px] text-[#c9aabc]/80">
            Na porta, diga o código da porta ou mostre o QR. A referência abaixo não entra.
          </p>
        </div>
      </section>
    </main>
  );
}
