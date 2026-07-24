import { NextResponse } from "next/server";

import { authorizeTicketAccess, loadTicketByCode, ticketIsQrEligible } from "@/lib/ticket-access";
import { appleWalletConfigured, buildApplePkpassBuffer } from "@/lib/wallet/apple";

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
    return NextResponse.json({ error: "Ingresso não elegível para Wallet" }, { status: 409 });
  }

  if (!appleWalletConfigured()) {
    return NextResponse.json(
      {
        error: "Apple Wallet não configurada",
        code: "APPLE_WALLET_NOT_CONFIGURED",
        fallback: "qr",
        message: "Baixe o QR e salve na Fotos, ou use Google Wallet.",
      },
      { status: 503 },
    );
  }

  try {
    const buffer = await buildApplePkpassBuffer(ticket);
    if (!buffer) {
      return NextResponse.json({ error: "Falha ao gerar pass" }, { status: 500 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="pinkpass-${ticket.code.slice(0, 8)}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar Apple Pass";
    return NextResponse.json({ error: message, fallback: "qr" }, { status: 500 });
  }
}
