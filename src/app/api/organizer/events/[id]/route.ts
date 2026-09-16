import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { organizerAuthError, requireApprovedOrganizer } from "@/lib/auth-guards";
import { organizerReceivingReady } from "@/lib/organizer-profile";
import { notifyEventWebhook } from "@/lib/organizer-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { organizerEventUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId(request);
  const auth = await requireApprovedOrganizer();
  const denied = organizerAuthError(auth, { allowAdminWithoutOrganizer: true });
  if (denied) return denied;

  const { id } = await context.params;
  const input = organizerEventUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return apiError(400, { message: "Dados inválidos", code: "VALIDATION_ERROR", requestId });
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id,organizer_id,status,starts_at,ends_at")
    .eq("id", id)
    .single();

  if (!event || (!auth.isAdmin && event.organizer_id !== auth.organizer?.id)) {
    return apiError(404, { message: "Evento não encontrado", code: "EVENT_NOT_FOUND", requestId });
  }

  if (input.data.startsAt && input.data.endsAt === undefined && event.ends_at) {
    if (new Date(event.ends_at).getTime() <= new Date(input.data.startsAt).getTime()) {
      return apiError(400, {
        message: "A data de término precisa ser posterior ao início",
        code: "VALIDATION_ERROR",
        requestId,
      });
    }
  }

  if (input.data.status === "published") {
    if (auth.organizer && !auth.isAdmin && !organizerReceivingReady(auth.organizer)) {
      return apiError(409, {
        message: "Conecte Asaas ou Mercado Pago antes de publicar",
        code: "PAYMENTS_NOT_READY",
        requestId,
      });
    }
    const { count } = await admin
      .from("ticket_batches")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id)
      .eq("is_active", true);
    if (!count) {
      return apiError(409, {
        message: "Adicione pelo menos um lote ativo antes de publicar",
        code: "BATCH_REQUIRED",
        requestId,
      });
    }
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.data.status) patch.status = input.data.status;
  if (input.data.title) patch.title = input.data.title;
  if (input.data.description !== undefined) patch.description = input.data.description || null;
  if (input.data.venueName) patch.venue_name = input.data.venueName;
  if (input.data.address) patch.address = input.data.address;
  if (input.data.city) patch.city = input.data.city;
  if (input.data.startsAt) patch.starts_at = input.data.startsAt;
  if (input.data.endsAt !== undefined) patch.ends_at = input.data.endsAt || null;
  if (input.data.coverImageUrl !== undefined) patch.cover_image_url = input.data.coverImageUrl || null;

  const { error } = await admin.from("events").update(patch).eq("id", id);
  if (error) {
    return apiError(500, { message: "Erro ao atualizar evento", code: "EVENT_UPDATE_FAILED", requestId, cause: error.message });
  }

  if (input.data.status === "published" && event.status !== "published") {
    await notifyEventWebhook(id, "event.published");
  } else if (input.data.status === "cancelled" && event.status !== "cancelled") {
    await notifyEventWebhook(id, "event.cancelled");
  } else {
    await notifyEventWebhook(id, "event.updated");
  }

  return apiOk({ ok: true }, { requestId });
}
