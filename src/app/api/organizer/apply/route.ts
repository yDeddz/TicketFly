import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { organizerApplySchema } from "@/lib/validators";

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  const input = organizerApplySchema.safeParse(await request.json().catch(() => null));

  if (!input.success) {
    return apiError(400, { message: "Dados da balada inválidos", code: "VALIDATION_ERROR", requestId });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, { message: "Faça login para se candidatar", code: "UNAUTHENTICATED", requestId });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("organizers")
    .select("id,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return apiError(409, {
      message: "Você já possui uma candidatura de parceiro",
      code: "ALREADY_APPLIED",
      requestId,
    });
  }

  const { data, error } = await admin
    .from("organizers")
    .insert({
      user_id: user.id,
      trade_name: input.data.tradeName,
      legal_name: input.data.legalName,
      document: input.data.document,
      phone: input.data.phone || null,
      city: input.data.city || null,
      partnership_notes: input.data.feeNote || null,
      status: "pending",
    })
    .select("id,status")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return apiError(409, {
        message: "Este CPF/CNPJ já está cadastrado",
        code: "DOCUMENT_TAKEN",
        requestId,
      });
    }
    return apiError(500, {
      message: "Erro ao criar candidatura",
      code: "APPLY_FAILED",
      requestId,
      cause: error?.message,
    });
  }

  await admin.from("users").update({ role: "organizer" }).eq("id", user.id).neq("role", "admin");

  return apiOk({ ok: true, organizerId: data.id, status: data.status }, { requestId });
}
