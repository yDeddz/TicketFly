import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { organizerAuthError, requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { batchUpdateSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId(request);
  const auth = await requireApprovedOrganizer();
  const denied = organizerAuthError(auth);
  if (denied) return denied;
  if (!auth.organizer) {
    return apiError(403, { message: "Sem permissão", code: "ORGANIZER_FORBIDDEN", requestId });
  }

  const { id } = await params;
  const input = batchUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return apiError(400, { message: "Dados inválidos", code: "VALIDATION_ERROR", requestId });
  }

  const admin = createAdminClient();
  const { data: batch } = await admin
    .from("ticket_batches")
    .select("id,quantity_sold,quantity_reserved,event_id,events(organizer_id)")
    .eq("id", id)
    .single();

  const event = Array.isArray(batch?.events) ? batch?.events[0] : batch?.events;
  if (!batch || event?.organizer_id !== auth.organizer.id) {
    return apiError(404, { message: "Lote não encontrado", code: "BATCH_NOT_FOUND", requestId });
  }

  if (input.data.quantityTotal != null) {
    const committed = (batch.quantity_sold ?? 0) + (batch.quantity_reserved ?? 0);
    if (input.data.quantityTotal < committed) {
      return apiError(409, {
        message: `Quantidade mínima é ${committed} (já vendidos/reservados)`,
        code: "BATCH_CAPACITY",
        requestId,
      });
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.data.name !== undefined) patch.name = input.data.name;
  if (input.data.priceCents !== undefined) patch.price_cents = input.data.priceCents;
  if (input.data.quantityTotal !== undefined) patch.quantity_total = input.data.quantityTotal;
  if (input.data.salesEndAt !== undefined) patch.sales_end_at = input.data.salesEndAt || null;
  if (input.data.isActive !== undefined) patch.is_active = input.data.isActive;

  if (Object.keys(patch).length === 0) {
    return apiError(400, { message: "Nada para atualizar", code: "VALIDATION_ERROR", requestId });
  }

  const { data, error } = await admin
    .from("ticket_batches")
    .update(patch)
    .eq("id", id)
    .select("id,name,price_cents,quantity_total,is_active,sales_end_at")
    .single();

  if (error || !data) {
    return apiError(500, { message: "Erro ao atualizar lote", code: "BATCH_UPDATE_FAILED", requestId, cause: error?.message });
  }

  return apiOk(data, { requestId });
}
