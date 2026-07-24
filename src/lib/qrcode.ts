import QRCode from "qrcode";

import { appUrl } from "@/lib/env";
import { signQrSessionPayload } from "@/lib/ticket-crypto";

export async function ticketQrDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

export async function issueLiveTicketQr(args: {
  ticketId: string;
  qrToken: string;
  qrVersion: number;
  ttlSeconds?: number;
}) {
  const session = await signQrSessionPayload(args);
  const dataUrl = await ticketQrDataUrl(session.payload);

  return {
    ...session,
    dataUrl,
  };
}

export function publicTicketUrl(code: string, accessToken?: string) {
  const base = `${appUrl()}/ingressos/${code}`;
  if (!accessToken) return base;
  return `${base}?access=${encodeURIComponent(accessToken)}`;
}
