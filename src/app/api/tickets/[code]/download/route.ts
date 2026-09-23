import { apiError, createRequestId } from "@/lib/api-error";
import { ticketQrDataUrl } from "@/lib/qrcode";
import {
  authorizeTicketAccess,
  loadTicketByCode,
  ticketIsQrEligible,
} from "@/lib/ticket-access";
import { renderTicketDownloadImage } from "@/lib/tickets/ticket-image";
import { ensureStableGateCode } from "@/lib/tickets/gate-code";
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
      message: "Acesso negado a este ingresso",
      code: "TICKET_FORBIDDEN",
      requestId,
    });
  }

  if (!ticketIsQrEligible(ticket.status)) {
    return apiError(409, {
      message: "O ingresso só pode ser baixado após a confirmação do pagamento",
      code: "TICKET_NOT_DOWNLOADABLE",
      requestId,
    });
  }

  const filename = ticketDownloadFilename(ticket);

  try {
    const gate = await ensureStableGateCode(ticket.id);
    const qrDataUrl = await ticketQrDataUrl(gate.raw);
    const image = renderTicketDownloadImage({ ticket, qrDataUrl, doorCode: gate.code });
    const body = await image.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "x-request-id": requestId,
      },
    });
  } catch (cause) {
    try {
      const png = await buildWalletQrPng(ticket);
      return new Response(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        },
      });
    } catch (fallbackCause) {
      return apiError(500, {
        message: "Não foi possível gerar o arquivo do ingresso",
        code: "TICKET_DOWNLOAD_FAILED",
        requestId,
        cause: fallbackCause ?? cause,
        path: "/api/tickets/[code]/download",
      });
    }
  }
}
