import { NextResponse } from "next/server";

import { authorizeTicketAccess, loadTicketByCode, ticketIsQrEligible } from "@/lib/ticket-access";
import { buildGoogleWalletSaveUrl, googleWalletConfigured } from "@/lib/wallet/google";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Params) {
  const { code } = await params;
  const ticket = await loadTicketByCode(code);

  if (!ticket) {
    return NextResponse.json({ error: "Ingresso não encontrado" }, { status: 404 });
  }

  const url = new URL(request.url);
  const access = url.searchParams.get("access");
  const redirect = url.searchParams.get("redirect") === "1";
  const auth = await authorizeTicketAccess({ ticket, accessToken: access });

  if (!auth.ok) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  if (!ticketIsQrEligible(ticket.status)) {
    return NextResponse.json({ error: "Ingresso não elegível para Wallet" }, { status: 409 });
  }

  if (!googleWalletConfigured()) {
    return NextResponse.json(
      {
        error: "Google Wallet não configurada",
        code: "GOOGLE_WALLET_NOT_CONFIGURED",
        fallback: "qr",
        message: "Baixe o QR e salve no dispositivo.",
      },
      { status: 503 },
    );
  }

  const saveUrl = await buildGoogleWalletSaveUrl(ticket);
  if (!saveUrl) {
    return NextResponse.json({ error: "Falha ao gerar Google Wallet" }, { status: 500 });
  }

  if (redirect) {
    return NextResponse.redirect(saveUrl, 302);
  }

  return NextResponse.json({ saveUrl });
}
