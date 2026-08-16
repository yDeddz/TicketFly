import { apiError, apiOk, createRequestId } from "@/lib/api-error";
import { requireApprovedOrganizer } from "@/lib/auth-guards";
import {
  createOrResumeDoorSale,
  DoorSaleError,
} from "@/lib/payments/door-sales";
import { createAdminClient } from "@/lib/supabase/admin";
import { doorSaleSchema } from "@/lib/validators";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return new URL(origin).host === new URL(request.url).host;
}

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  if (!isSameOrigin(request)) {
    return apiError(403, {
      message: "Origem da requisição inválida",
      code: "INVALID_ORIGIN",
      requestId,
    });
  }

  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.user || !auth.organizer) {
    return apiError(auth.status, {
      message: auth.error ?? "Organizador obrigatório",
      code: "UNAUTHORIZED",
      requestId,
    });
  }

  const input = doorSaleSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return apiError(400, {
      message: input.error.issues[0]?.message ?? "Dados inválidos",
      code: "VALIDATION_ERROR",
      requestId,
    });
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,asaas_wallet_id,asaas_connection_status")
    .eq("id", auth.organizer.id)
    .single();

  if (
    !organizer?.asaas_wallet_id ||
    organizer.asaas_connection_status !== "connected"
  ) {
    return apiError(409, {
      message: "Conecte sua conta Asaas antes de usar a Bilheteria na Porta",
      code: "ASAAS_NOT_CONNECTED",
      requestId,
    });
  }

  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("created_by", auth.user.id)
    .eq("idempotency_key", input.data.idempotencyKey)
    .maybeSingle();

  if (!existing) {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("created_by", auth.user.id)
      .eq("sales_channel", "door")
      .gte("created_at", since);

    if ((count ?? 0) >= 20) {
      return apiError(429, {
        message: "Muitas transações em pouco tempo. Aguarde um minuto.",
        code: "RATE_LIMITED",
        requestId,
      });
    }
  }

  try {
    const result = await createOrResumeDoorSale({
      organizerId: organizer.id,
      asaasWalletId: organizer.asaas_wallet_id,
      operatorUserId: auth.user.id,
      batchId: input.data.batchId,
      buyerName: input.data.buyerName,
      buyerEmail: input.data.buyerEmail,
      buyerCpf: input.data.buyerCpf,
      buyerPhone: input.data.buyerPhone,
      paymentMethod: input.data.paymentMethod,
      idempotencyKey: input.data.idempotencyKey,
    });

    return apiOk(
      {
        paymentId: result.payment_id,
        ticketCode: result.ticket_code,
        eventTitle: result.event_title,
        batchName: result.batch_name,
        amountCents: result.amount_cents,
        status: result.status,
        buyerUrl: result.buyerUrl,
        checkoutUrl: result.checkoutUrl,
        pix: result.pix,
        existing: result.existing,
      },
      { requestId, status: result.existing ? 200 : 201 },
    );
  } catch (cause) {
    if (cause instanceof DoorSaleError) {
      return apiError(cause.status, {
        message: cause.message,
        code: cause.code,
        requestId,
        ...(cause.status >= 500 ? { cause } : {}),
      });
    }

    return apiError(500, {
      message: "Falha inesperada ao criar venda",
      code: "DOOR_SALE_FAILED",
      requestId,
      cause,
    });
  }
}

