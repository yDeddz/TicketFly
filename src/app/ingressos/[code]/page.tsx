import { notFound } from "next/navigation";
import Image from "next/image";

import { formatDateTime } from "@/lib/format";
import { ticketQrDataUrl } from "@/lib/qrcode";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("code,qr_token,status,buyer_name,buyer_email,events(title,starts_at,venue_name,address),ticket_batches(name)")
    .eq("code", code)
    .single();

  if (!ticket) {
    notFound();
  }

  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;
  const batch = Array.isArray(ticket.ticket_batches) ? ticket.ticket_batches[0] : ticket.ticket_batches;
  const qrDataUrl = ticket.status === "paid" ? await ticketQrDataUrl(ticket.qr_token) : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <section className="overflow-hidden rounded-lg border border-[#ff1493]/30 bg-[#120410] shadow-sm shadow-[#ff1493]/10">
        <div className="bg-[#090008] p-5 text-white">
          <p className="text-sm font-bold uppercase text-[#ff1493]">Ingresso PinkPass</p>
          <h1 className="mt-2 text-2xl font-black">{event?.title}</h1>
          <p className="mt-2 text-white/75">{event?.starts_at ? formatDateTime(event.starts_at) : ""}</p>
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
          {qrDataUrl ? (
            <Image
              unoptimized
              className="mx-auto h-72 w-72 rounded-md bg-white p-3"
              src={qrDataUrl}
              alt="QR Code do ingresso"
              width={288}
              height={288}
            />
          ) : (
            <div className="rounded-md border border-[#f5a524]/50 bg-[#261802] p-4 text-sm font-medium text-[#ffd27a]">
              QR Code indisponível até o pagamento ser aprovado. Status atual: {ticket.status}.
            </div>
          )}
          <p className="break-all rounded-md bg-[#210018] p-3 text-center font-mono text-xs text-[#ffb1d5]">{ticket.code}</p>
        </div>
      </section>
    </main>
  );
}
