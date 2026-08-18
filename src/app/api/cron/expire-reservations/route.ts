import { apiError, apiOk, createRequestId, logServerError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Expire abandoned pending reservations.
 * Production scheduler is an external HTTP cron. Hobby cannot use a 10-minute Vercel schedule.
 * Protect with CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 * or x-cron-secret: <CRON_SECRET>
 */
export async function POST(request: Request) {
  const requestId = createRequestId(request);
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!expected || (bearer !== expected && headerSecret !== expected)) {
    return apiError(401, {
      message: "Não autorizado",
      code: "UNAUTHORIZED",
      requestId,
    });
  }

  const url = new URL(request.url);
  const minutes = Number(url.searchParams.get("minutes") ?? "30");
  const ttl = Number.isFinite(minutes) ? Math.max(5, Math.min(minutes, 24 * 60)) : 30;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("expire_stale_reservations", {
      p_older_than_minutes: ttl,
    });

    if (error) {
      logServerError({
        requestId,
        code: "EXPIRE_RESERVATIONS_FAILED",
        message: error.message,
        path: "/api/cron/expire-reservations",
      });
      return apiError(500, {
        message: "Falha ao expirar reservas",
        code: "EXPIRE_RESERVATIONS_FAILED",
        requestId,
        cause: error,
      });
    }

    return apiOk({ ok: true, expired: data ?? 0, ttlMinutes: ttl }, { requestId });
  } catch (cause) {
    return apiError(500, {
      message: "Falha ao expirar reservas",
      code: "EXPIRE_RESERVATIONS_FAILED",
      requestId,
      cause,
    });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
