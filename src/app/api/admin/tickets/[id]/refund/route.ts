import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-guards";
import { refundTicketLocally } from "@/lib/refunds";

const bodySchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  tryMercadoPago: z.boolean().optional().default(true),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const input = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!input.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const result = await refundTicketLocally({
    ticketId: id,
    actorUserId: auth.user.id,
    reason: input.data.reason || "Reembolso administrativo",
    tryMercadoPago: input.data.tryMercadoPago,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, mpRefunded: result.mpRefunded });
}
