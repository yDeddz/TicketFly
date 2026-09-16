import QRCode from "qrcode";

import { slugify } from "@/lib/format";
import type { TicketAccessRow } from "@/lib/ticket-access";
import { unwrapRelation } from "@/lib/ticket-access";
import { signWalletBarcodePayload, WALLET_PASS_GRACE_SECONDS } from "@/lib/ticket-crypto";

export function walletBarcodeExpiresAt(ticket: TicketAccessRow) {
  const event = unwrapRelation(ticket.events);
  const end = event?.ends_at ? new Date(event.ends_at) : event?.starts_at ? new Date(event.starts_at) : new Date();
  const base = Number.isNaN(end.getTime()) ? new Date() : end;
  return new Date(base.getTime() + WALLET_PASS_GRACE_SECONDS * 1000);
}

export async function buildWalletQrPng(ticket: TicketAccessRow) {
  const barcode = await signWalletBarcodePayload({
    ticketId: ticket.id,
    qrToken: ticket.qr_token,
    qrVersion: ticket.qr_version ?? 1,
    expiresAt: walletBarcodeExpiresAt(ticket),
  });

  return QRCode.toBuffer(barcode, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 720,
  });
}

export async function buildWalletQrDataUrl(ticket: TicketAccessRow) {
  const png = await buildWalletQrPng(ticket);
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

export function ticketDownloadFilename(ticket: TicketAccessRow) {
  const event = unwrapRelation(ticket.events);
  const slug = slugify(event?.title ?? "") || ticket.code.slice(0, 8);
  return `ingresso-${slug.slice(0, 48)}.png`;
}
