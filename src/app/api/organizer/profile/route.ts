import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { organizerAuthError, requireOrganizerAccount } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { organizerProfileSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  const requestId = createRequestId(request);
  const auth = await requireOrganizerAccount({ allowPending: true });
  const denied = organizerAuthError(auth);
  if (denied) return denied;
  if (!auth.organizer) {
    return apiError(403, { message: "Sem permissão", code: "ORGANIZER_FORBIDDEN", requestId });
  }

  const parsed = organizerProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, { message: "Dados do perfil inválidos", code: "VALIDATION_ERROR", requestId });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizers")
    .update({
      trade_name: parsed.data.tradeName,
      legal_name: parsed.data.legalName,
      document: parsed.data.document,
      phone: parsed.data.phone,
      city: parsed.data.city,
      address: parsed.data.address,
      address_number: parsed.data.addressNumber,
      complement: parsed.data.complement || null,
      province: parsed.data.province,
      postal_code: parsed.data.postalCode,
      birth_date: parsed.data.document.length === 11 ? parsed.data.birthDate || null : null,
      company_type: parsed.data.document.length === 14 ? parsed.data.companyType || null : null,
    })
    .eq("id", auth.organizer.id)
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return apiError(409, { message: "Este CPF/CNPJ já está em uso", code: "DOCUMENT_TAKEN", requestId });
    }
    return apiError(500, {
      message: "Erro ao salvar perfil",
      code: "PROFILE_UPDATE_FAILED",
      requestId,
      cause: error?.message,
    });
  }

  return apiOk({ ok: true }, { requestId });
}
