import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { claimTicketsForBuyer } from "@/lib/tickets/claim";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return apiError(401, {
      message: "Faça login para vincular seus ingressos",
      code: "UNAUTHORIZED",
      requestId,
    });
  }

  const result = await claimTicketsForBuyer({ userId: user.id, email: user.email });

  if (!result.ok) {
    return apiError(500, {
      message: "Não foi possível vincular seus ingressos ao perfil",
      code: "TICKET_CLAIM_FAILED",
      requestId,
      cause: result.error,
      path: "/api/tickets/claim",
    });
  }

  return apiOk({ claimed: result.claimed }, { requestId });
}
