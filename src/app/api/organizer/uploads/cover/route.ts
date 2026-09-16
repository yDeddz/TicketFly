import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { organizerAuthError, requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  const auth = await requireApprovedOrganizer();
  const denied = organizerAuthError(auth);
  if (denied) return denied;
  if (!auth.organizer) {
    return apiError(403, { message: "Sem permissão", code: "ORGANIZER_FORBIDDEN", requestId });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return apiError(400, { message: "Envie uma imagem de capa", code: "VALIDATION_ERROR", requestId });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return apiError(400, { message: "Use JPEG, PNG ou WebP", code: "VALIDATION_ERROR", requestId });
  }
  if (file.size > MAX_BYTES) {
    return apiError(400, { message: "A capa deve ter no máximo 5 MB", code: "VALIDATION_ERROR", requestId });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${auth.organizer.id}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from("event-covers").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return apiError(503, {
      message: "Upload de capa indisponível no momento",
      code: "COVER_UPLOAD_FAILED",
      requestId,
      cause: error.message,
    });
  }

  const { data } = admin.storage.from("event-covers").getPublicUrl(path);
  return apiOk({ url: data.publicUrl }, { requestId });
}
