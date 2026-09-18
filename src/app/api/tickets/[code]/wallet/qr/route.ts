import { apiError, createRequestId } from "@/lib/api-error";
import { authorizeTicketAccess, loadTicketByCode, ticketIsQrEligible } from "@/lib/ticket-access";
import { buildWalletQrPng, ticketDownloadFilename } from "@/lib/tickets/wallet-qr";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Params) {
  const requestId = createRequestId(request);
  const { code } = await params;
  const ticket = await loadTicketByCode(code);

  if (!ticket) {
    return apiError(404, {
      message: "Ingresso não encontrado",
      code: "TICKET_NOT_FOUND",
      requestId,
    });
  }

  const access = new URL(request.url).searchParams.get("access");
  const auth = await authorizeTicketAccess({ ticket, accessToken: access });

  if (!auth.ok) {
    return apiError(403, {
      message: "Acesso negado",
      code: "TICKET_FORBIDDEN",
      requestId,
    });
  }

  if (!ticketIsQrEligible(ticket.status)) {
    return apiError(409, {
      message: "QR Code indisponível para este ingresso",
      code: "TICKET_QR_UNAVAILABLE",
      requestId,
    });
  }

  try {
    const png = await buildWalletQrPng(ticket);
    const filename = ticketDownloadFilename(ticket);

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "x-request-id": requestId,
      },
    });
  } catch (cause) {
    return apiError(500, {
      message: "Não foi possível gerar o QR do ingresso",
      code: "TICKET_QR_FAILED",
      requestId,
      cause,
      path: "/api/tickets/[code]/wallet/qr",
    });
  }
}
