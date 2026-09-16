import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { organizerAuthError, requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { batchSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  const auth = await requireApprovedOrganizer();
  const denied = organizerAuthError(auth);
  if (denied) return denied;
  if (!auth.organizer) {
    return apiError(403, { message: "Sem permissão", code: "ORGANIZER_FORBIDDEN", requestId });
  }

  const input = batchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return apiError(400, { message: "Dados do lote inválidos", code: "VALIDATION_ERROR", requestId });
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id,organizer_id")
    .eq("id", input.data.eventId)
    .single();

  if (!event || event.organizer_id !== auth.organizer.id) {
    return apiError(403, { message: "Sem permissão neste evento", code: "EVENT_FORBIDDEN", requestId });
  }

  const { data, error } = await admin
    .from("ticket_batches")
    .insert({
      event_id: input.data.eventId,
      name: input.data.name,
      description: input.data.description || null,
      price_cents: input.data.priceCents,
      quantity_total: input.data.quantityTotal,
      sales_end_at: input.data.salesEndAt || null,
      switch_at: input.data.switchAt || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return apiError(500, { message: "Erro ao criar lote", code: "BATCH_CREATE_FAILED", requestId, cause: error?.message });
  }

  return apiOk(data, { requestId });
}
