import { apiError, createRequestId } from "@/lib/api-error";

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  return apiError(403, {
    message: "O provedor e o recebedor são gerenciados pela administração TicketFly",
    code: "PAYMENT_PROVIDER_ADMIN_ONLY",
    requestId,
  });
}
