import { apiError, createRequestId } from "@/lib/api-error";

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  return apiError(403, {
    message: "A conta de recebimento é gerenciada pela administração TicketFly",
    code: "PAYMENT_PROVIDER_ADMIN_ONLY",
    requestId,
  });
}
