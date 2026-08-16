import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundTicketLocally } from "@/lib/refunds";

const bodySchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.user || (!auth.organizer && !auth.isAdmin)) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const { id } = await context.params;
  const input = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!input.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id,event_id,events(organizer_id)")
    .eq("id", id)
    .single();

  const event = Array.isArray(ticket?.events) ? ticket?.events[0] : ticket?.events;
  if (!ticket || (!auth.isAdmin && event?.organizer_id !== auth.organizer?.id)) {
    return NextResponse.json({ error: "Ingresso não encontrado neste parceiro" }, { status: 404 });
  }

  const result = await refundTicketLocally({
    ticketId: id,
    actorUserId: auth.user.id,
    reason: input.data.reason || "Reembolso pelo parceiro",
    tryMercadoPago: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    mpRefunded: result.mpRefunded,
    providerRefunded: result.providerRefunded,
    partial: result.partial,
    message: result.partial
      ? "Ingresso cancelado localmente, mas o estorno no provedor falhou — verifique manualmente no painel do pagamento."
      : result.providerRefunded
        ? "Reembolso processado (inclui estorno no provedor)."
        : "Reembolso registrado localmente.",
  });
}
