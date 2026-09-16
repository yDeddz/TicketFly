import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { organizerAuthError, requireApprovedOrganizer } from "@/lib/auth-guards";
import { slugify } from "@/lib/format";
import { organizerReceivingReady } from "@/lib/organizer-profile";
import { notifyEventWebhook } from "@/lib/organizer-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  const auth = await requireApprovedOrganizer();
  const denied = organizerAuthError(auth);
  if (denied) return denied;
  if (!auth.organizer) {
    return apiError(403, { message: "Organizador não aprovado", code: "ORGANIZER_FORBIDDEN", requestId });
  }

  const input = eventSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return apiError(400, { message: "Dados do evento inválidos", code: "VALIDATION_ERROR", requestId });
  }

  const slug = `${slugify(input.data.title)}-${crypto.randomUUID().slice(0, 8)}`;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .insert({
      organizer_id: auth.organizer.id,
      title: input.data.title,
      slug,
      description: input.data.description || null,
      venue_name: input.data.venueName,
      address: input.data.address,
      city: input.data.city,
      starts_at: input.data.startsAt,
      ends_at: input.data.endsAt || null,
      cover_image_url: input.data.coverImageUrl || null,
      status: "draft",
    })
    .select("id,slug")
    .single();

  if (error || !data) {
    return apiError(500, {
      message: "Erro ao criar evento",
      code: "EVENT_CREATE_FAILED",
      requestId,
      cause: error?.message,
    });
  }

  if (input.data.batch) {
    const { error: batchError } = await admin.from("ticket_batches").insert({
      event_id: data.id,
      name: input.data.batch.name,
      price_cents: input.data.batch.priceCents,
      quantity_total: input.data.batch.quantityTotal,
    });
    if (batchError) {
      return apiOk(
        {
          id: data.id,
          slug: data.slug,
          batchWarning: "Evento criado, mas o lote não foi salvo. Adicione o lote em seguida.",
        },
        { requestId },
      );
    }
  }

  await notifyEventWebhook(data.id, "event.created");
  return apiOk({ id: data.id, slug: data.slug }, { requestId });
}
