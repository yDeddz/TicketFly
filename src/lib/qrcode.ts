import QRCode from "qrcode";

import { appUrl } from "@/lib/env";

export function ticketScanPayload(qrToken: string) {
  return qrToken;
}

export async function ticketQrDataUrl(qrToken: string) {
  return QRCode.toDataURL(ticketScanPayload(qrToken), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
  });
}

export function publicTicketUrl(code: string) {
  return `${appUrl()}/ingressos/${code}`;
}
