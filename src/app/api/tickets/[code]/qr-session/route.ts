import { NextResponse } from "next/server";

import { issueLiveTicketQr } from "@/lib/qrcode";
import {
  authorizeTicketAccess,
  loadTicketByCode,
  ticketIsQrEligible,
} from "@/lib/ticket-access";

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
    return NextResponse.json({ error: "Acesso negado ao QR deste ingresso" }, { status: 403 });
  }

  if (!ticketIsQrEligible(ticket.status)) {
    return NextResponse.json(
      {
        error: "QR indisponível",
        status: ticket.status,
        message:
          ticket.status === "used"
            ? "Ingresso já utilizado"
            : ticket.status === "cancelled"
              ? "Ingresso cancelado"
              : "Aguardando confirmação de pagamento",
      },
      { status: 409 },
    );
  }

  const session = await issueLiveTicketQr({
    ticketId: ticket.id,
    qrToken: ticket.qr_token,
    qrVersion: ticket.qr_version ?? 1,
  });

  return NextResponse.json(
    {
      code: ticket.code,
      status: ticket.status,
      payload: session.payload,
      dataUrl: session.dataUrl,
      expiresAt: session.expiresAt,
      expiresInSeconds: session.expiresInSeconds,
      refreshAfterSeconds: Math.max(20, Math.floor(session.expiresInSeconds * 0.55)),
      version: ticket.qr_version ?? 1,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
