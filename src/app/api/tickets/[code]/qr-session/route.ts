import { NextResponse } from "next/server";

import { ticketQrDataUrl } from "@/lib/qrcode";
import {
  authorizeTicketAccess,
  loadTicketByCode,
  ticketIsQrEligible,
} from "@/lib/ticket-access";
import { ensureStableGateCode } from "@/lib/tickets/gate-code";

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
        error: "QR Code indisponível",
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

  let gate: Awaited<ReturnType<typeof ensureStableGateCode>>;
  try {
    gate = await ensureStableGateCode(ticket.id);
  } catch {
    return NextResponse.json({ error: "Não foi possível gerar o código da porta" }, { status: 500 });
  }

  const dataUrl = await ticketQrDataUrl(gate.raw);

  return NextResponse.json(
    {
      code: ticket.code,
      status: ticket.status,
      dataUrl,
      expiresAt: gate.expiresAt,
      manualCode: gate.code,
      buyerName: ticket.buyer_name,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
