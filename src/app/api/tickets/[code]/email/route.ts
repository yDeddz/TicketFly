import { NextResponse } from "next/server";

import { authorizeTicketAccess, loadTicketByCode, ticketIsQrEligible } from "@/lib/ticket-access";
import { deliverTicketEmail } from "@/lib/tickets/ticket-email";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  const { code } = await params;
  const ticket = await loadTicketByCode(code);

  if (!ticket) {
    return NextResponse.json({ error: "Ingresso não encontrado" }, { status: 404 });
  }

  const access = new URL(request.url).searchParams.get("access");
  const auth = await authorizeTicketAccess({ ticket, accessToken: access });
  if (!auth.ok) {
    return NextResponse.json({ error: "Acesso negado a este ingresso" }, { status: 403 });
  }

  if (!ticketIsQrEligible(ticket.status)) {
    return NextResponse.json({ error: "O e-mail sai depois que o pagamento confirma" }, { status: 409 });
  }

  const sent = await deliverTicketEmail(ticket.id);
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
