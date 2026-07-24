import { NextResponse } from "next/server";

import { issueLiveTicketQr } from "@/lib/qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authorizeTicketAccess,
  loadTicketByCode,
  ticketIsQrEligible,
} from "@/lib/ticket-access";
import {
  formatManualGateCode,
  generateManualGateCode,
  QR_SESSION_TTL_SECONDS,
} from "@/lib/ticket-crypto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

async function persistManualGateCode(ticketId: string, expiresAtIso: string) {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const manualCode = generateManualGateCode();
    const { error } = await admin
      .from("tickets")
      .update({
        manual_code: manualCode,
        manual_code_expires_at: expiresAtIso,
      })
      .eq("id", ticketId);

    if (!error) {
      return formatManualGateCode(manualCode);
    }

    // Unique collision on manual_code — retry with a new code.
    if (error.code !== "23505") {
      throw error;
    }
  }

  throw new Error("failed_to_allocate_manual_code");
}

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
    ttlSeconds: QR_SESSION_TTL_SECONDS,
  });

  let manualCode: string | null = null;
  try {
    manualCode = await persistManualGateCode(ticket.id, session.expiresAt);
  } catch {
    // QR still works if manual code allocation fails; staff can retry refresh.
    manualCode = null;
  }

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
      manualCode,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
