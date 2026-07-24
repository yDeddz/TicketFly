import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { notifyEventWebhook } from "@/lib/organizer-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  status: z.enum(["draft", "published", "cancelled", "finished"]).optional(),
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.user || (!auth.organizer && !auth.isAdmin)) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const { id } = await context.params;
  const input = updateSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id,organizer_id,status").eq("id", id).single();

  if (!event || (!auth.isAdmin && event.organizer_id !== auth.organizer?.id)) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.data.status) patch.status = input.data.status;
  if (input.data.title) patch.title = input.data.title;
  if (input.data.description !== undefined) patch.description = input.data.description || null;

  const { error } = await admin.from("events").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Erro ao atualizar evento" }, { status: 500 });
  }

  if (input.data.status === "published" && event.status !== "published") {
    await notifyEventWebhook(id, "event.published");
  } else if (input.data.status === "cancelled" && event.status !== "cancelled") {
    await notifyEventWebhook(id, "event.cancelled");
  } else {
    await notifyEventWebhook(id, "event.updated");
  }

  return NextResponse.json({ ok: true });
}
