import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-guards";
import { hasPagarmeSecret, PagarmeRequestError, pagarmeGetRecipient } from "@/lib/payments/pagarme-client";
import { recipientLinkBlock } from "@/lib/payments/stone-recipient";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminOrganizerUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const requestId = createRequestId(request);
  const auth = await requireAdmin();

  if (auth.error || !auth.user) {
    return apiError(auth.status, { message: auth.error ?? "Sem permissão", code: "ADMIN_FORBIDDEN", requestId });
  }

  const input = adminOrganizerUpdateSchema.safeParse(await request.json());
  if (!input.success) {
    return apiError(400, { message: "Dados do organizador inválidos", code: "VALIDATION_ERROR", requestId });
  }

  const recipientId = input.data.pagarmeRecipientId || null;
  let recipientStatus: string | null = null;

  if (recipientId && hasPagarmeSecret()) {
    try {
      const recipient = await pagarmeGetRecipient(recipientId);
      recipientStatus = recipient.status ?? null;
    } catch (cause) {
      if (cause instanceof PagarmeRequestError && cause.status === 404) {
        return apiError(404, {
          message: "Recebedor não encontrado na Stone",
          code: "RECIPIENT_NOT_FOUND",
          requestId,
        });
      }
      return apiError(502, {
        message: "Não foi possível validar o recebedor na Stone",
        code: "STONE_UNAVAILABLE",
        requestId,
        cause,
      });
    }
  }

  if (recipientId) {
    const block = recipientLinkBlock({
      recipientId,
      platformRecipientId: process.env.PAGARME_PLATFORM_RECIPIENT_ID,
      status: recipientStatus,
    });
    if (block) {
      return apiError(409, { message: block.message, code: block.code, requestId });
    }
  }

  const admin = createAdminClient();

  if (recipientId) {
    const { data: taken } = await admin
      .from("organizers")
      .select("id,trade_name")
      .eq("pagarme_recipient_id", recipientId)
      .neq("id", id)
      .maybeSingle();

    if (taken) {
      return apiError(409, {
        message: `Este recebedor já está vinculado a ${taken.trade_name}`,
        code: "RECIPIENT_TAKEN",
        requestId,
      });
    }
  }

  const updatePayload: Record<string, unknown> = {
    status: input.data.status,
    fee_threshold_cents: input.data.feeThresholdCents,
    fee_percent_upto_threshold: input.data.feePercentUptoThreshold,
    fee_percent_above_threshold: input.data.feePercentAboveThreshold,
    service_fee_platform_share_percent: input.data.serviceFeePlatformSharePercent,
    pagarme_recipient_id: recipientId,
    pagarme_connection_status: recipientId ? "connected" : "disconnected",
    primary_payment_provider: "pagarme",
  };

  if (input.data.status === "approved") {
    updatePayload.approved_by = auth.user.id;
    updatePayload.approved_at = new Date().toISOString();
  }

  const { data, error } = await admin.from("organizers").update(updatePayload).eq("id", id).select("id").single();

  if (error?.code === "23505") {
    return apiError(409, {
      message: "Este recebedor Stone já está vinculado a outra casa",
      code: "RECIPIENT_TAKEN",
      requestId,
    });
  }

  if (error || !data) {
    return apiError(500, {
      message: "Erro ao atualizar organizador",
      code: "ORGANIZER_UPDATE_FAILED",
      requestId,
      cause: error?.message,
    });
  }

  return apiOk({ ok: true }, { requestId });
}
