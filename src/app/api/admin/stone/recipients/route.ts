import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-guards";
import { hasPagarmeSecret, pagarmeListRecipients, toStoneRecipient } from "@/lib/payments/pagarme-client";

export async function GET(request: Request) {
  const requestId = createRequestId(request);
  const auth = await requireAdmin();
  if (auth.error) {
    return apiError(auth.status, { message: auth.error, code: "ADMIN_FORBIDDEN", requestId });
  }

  if (!hasPagarmeSecret()) {
    return apiOk({ configured: false, recipients: [] }, { requestId });
  }

  try {
    const platformId = process.env.PAGARME_PLATFORM_RECIPIENT_ID;
    const recipients = (await pagarmeListRecipients())
      .filter((recipient) => recipient.id && recipient.id !== platformId)
      .map(toStoneRecipient);

    return apiOk({ configured: true, recipients }, { requestId });
  } catch (cause) {
    return apiError(502, {
      message: "Não foi possível listar os recebedores da Stone",
      code: "STONE_UNAVAILABLE",
      requestId,
      cause,
    });
  }
}
