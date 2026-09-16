import { ImageResponse } from "next/og";

import { formatDateTime } from "@/lib/format";
import type { TicketAccessRow } from "@/lib/ticket-access";
import { unwrapRelation } from "@/lib/ticket-access";

export function renderTicketDownloadImage(args: {
  ticket: TicketAccessRow;
  qrDataUrl: string;
}) {
  const event = unwrapRelation(args.ticket.events);
  const batch = unwrapRelation(args.ticket.ticket_batches);
  const when = event?.starts_at ? formatDateTime(event.starts_at) : "";
  const venue = [event?.venue_name, event?.city].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#090008",
          color: "#ffffff",
          padding: 48,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#ff1493",
            }}
          >
            TicketFly
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 16,
              fontSize: 44,
              fontWeight: 900,
              lineHeight: 1.1,
            }}
          >
            {event?.title ?? "Ingresso"}
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 22, color: "#c9aabc" }}>{when}</div>
          {venue ? (
            <div style={{ display: "flex", marginTop: 6, fontSize: 20, color: "#c9aabc" }}>{venue}</div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 36,
            padding: 28,
            background: "#120410",
            borderRadius: 24,
            border: "2px solid rgba(255,20,147,0.35)",
          }}
        >
          <img src={args.qrDataUrl} width={420} height={420} />
          <div style={{ display: "flex", marginTop: 18, fontSize: 18, color: "#ffb1d5" }}>
            QR válido até o fim do evento
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 32, gap: 8 }}>
          <div style={{ display: "flex", fontSize: 20 }}>
            <span style={{ color: "#c9aabc", marginRight: 8 }}>Participante</span>
            <span style={{ fontWeight: 700 }}>{args.ticket.buyer_name}</span>
          </div>
          {batch?.name ? (
            <div style={{ display: "flex", fontSize: 20 }}>
              <span style={{ color: "#c9aabc", marginRight: 8 }}>Lote</span>
              <span style={{ fontWeight: 700 }}>{batch.name}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: 8, fontSize: 16, color: "#ffb1d5" }}>
            Ref. {args.ticket.code}
          </div>
        </div>
      </div>
    ),
    {
      width: 720,
      height: 1180,
    },
  );
}
