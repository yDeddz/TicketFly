import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { loadDoorSaleStatus } from "@/lib/payments/door-sales-status";
import { verifyDoorPaymentAccessToken } from "@/lib/ticket-crypto";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const requestId = createRequestId(request);
  const { token } = await context.params;
  const claims = await verifyDoorPaymentAccessToken(decodeURIComponent(token));

  if (!claims) {
    return apiError(401, {
      message: "Link de pagamento inválido ou expirado",
      code: "INVALID_PAYMENT_LINK",
      requestId,
    });
  }

  const state = await loadDoorSaleStatus(claims.paymentId);
  if (!state) {
    return apiError(404, {
      message: "Pagamento não encontrado",
      code: "PAYMENT_NOT_FOUND",
      requestId,
    });
  }

  return apiOk(
    {
      paymentId: state.paymentId,
      status: state.status,
      amountCents: state.amountCents,
      paymentMethod: state.paymentMethod,
      checkoutUrl: state.checkoutUrl,
      pix: state.pix,
      ticketHref: state.ticketHref,
      ticketStatus: state.ticketStatus,
      eventTitle: state.eventTitle,
      batchName: state.batchName,
    },
    { requestId },
  );
}

