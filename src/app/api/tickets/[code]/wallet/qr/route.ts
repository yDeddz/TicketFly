import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { authorizeTicketAccess, loadTicketByCode, ticketIsQrEligible, unwrapRelation } from "@/lib/ticket-access";
import { signWalletBarcodePayload, WALLET_PASS_GRACE_SECONDS } from "@/lib/ticket-crypto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Params) {
  const { code } = await params;
  const ticket = await loadTicketByCode(code);

  if (!ticket) {
    return NextResponse.json({ error: "Ingresso não encontrado" }, { status: 404 });
  }

  const access = new URL(request.url).searchParams.get("access");
  const auth = await authorizeTicketAccess({ ticket, accessToken: access });

  if (!auth.ok) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  if (!ticketIsQrEligible(ticket.status)) {
    return NextResponse.json({ error: "QR indisponível para este status" }, { status: 409 });
  }

  const event = unwrapRelation(ticket.events);
  const end = event?.ends_at
    ? new Date(event.ends_at)
    : event?.starts_at
      ? new Date(event.starts_at)
      : new Date();
  const expiresAt = new Date(
    (Number.isNaN(end.getTime()) ? Date.now() : end.getTime()) + WALLET_PASS_GRACE_SECONDS * 1000,
  );

  const barcode = await signWalletBarcodePayload({
    ticketId: ticket.id,
    qrToken: ticket.qr_token,
    qrVersion: ticket.qr_version ?? 1,
    expiresAt,
  });

  const png = await QRCode.toBuffer(barcode, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 720,
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="pinkpass-${ticket.code.slice(0, 8)}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
