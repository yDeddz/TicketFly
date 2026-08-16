import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { appUrl } from "@/lib/env";
import { loadDoorSaleStatus } from "@/lib/payments/door-sales-status";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId(request);
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.user || !auth.organizer) {
    return apiError(auth.status, {
      message: auth.error ?? "Organizador obrigatório",
      code: "UNAUTHORIZED",
      requestId,
    });
  }

  const { id } = await context.params;
  const state = await loadDoorSaleStatus(id);

  if (!state || state.organizerId !== auth.organizer.id) {
    return apiError(404, {
      message: "Venda não encontrada",
      code: "DOOR_SALE_NOT_FOUND",
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
      buyerUrl: `${appUrl()}/pagar/${encodeURIComponent(state.buyerToken)}`,
      pix: state.pix,
      ticketHref: state.ticketHref,
      ticketStatus: state.ticketStatus,
      eventTitle: state.eventTitle,
      batchName: state.batchName,
    },
    { requestId },
  );
}

