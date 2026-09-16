import { NextResponse } from "next/server";

import {
  mapPagarmeStatus,
  verifyPagarmeWebhookSecret,
  type PagarmeOrder,
} from "@/lib/payments/pagarme-client";
import { notifySaleCompleted, notifySaleRefunded } from "@/lib/organizer-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachPaidTicketsToBuyerAccount } from "@/lib/tickets/claim";

type PagarmeWebhook = {
  id?: string;
  type?: string;
  data?: PagarmeOrder & {
    order?: PagarmeOrder;
    last_transaction?: { status?: string };
  };
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("token");

  if (!verifyPagarmeWebhookSecret(secret)) {
    return NextResponse.json({ error: "Webhook não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PagarmeWebhook | null;
  const resource = body?.data?.order ?? body?.data;
  const localPaymentId =
    typeof resource?.metadata?.payment_id === "string"
      ? resource.metadata.payment_id
      : resource?.code;

  if (!resource?.id || !localPaymentId) {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("payments")
    .select("id,status,amount_cents,provider,provider_preference_id,provider_payment_id")
    .eq("id", localPaymentId)
    .maybeSingle();

  if (!before || before.provider !== "pagarme") {
    return NextResponse.json({ error: "Pagamento local não confere" }, { status: 202 });
  }
  if (before.provider_preference_id && before.provider_preference_id !== resource.id) {
    return NextResponse.json({ error: "Pedido não confere" }, { status: 202 });
  }
  if (typeof resource.amount === "number" && resource.amount !== before.amount_cents) {
    return NextResponse.json({ error: "Valor não confere" }, { status: 202 });
  }

  const eventType = body?.type ?? "";
  const charge = resource.charges?.[0];
  let status = mapPagarmeStatus(charge?.status ?? resource.status);
  if (eventType.endsWith(".paid")) status = "approved";
  if (eventType.endsWith(".refunded") || eventType.endsWith(".chargedback")) status = "refunded";
  if (eventType.endsWith(".canceled") || eventType.endsWith(".cancelled")) status = "cancelled";
  if (eventType.endsWith(".payment_failed") || eventType.endsWith(".failed")) status = "rejected";

  const providerPaymentId = charge?.id ?? before.provider_payment_id;
  const { error } = await admin.rpc("apply_payment_status", {
    p_payment_id: localPaymentId,
    p_status: status,
    p_provider_payment_id: providerPaymentId,
    p_payload: body,
  });
  if (error) {
    return NextResponse.json({ error: "Falha ao aplicar status" }, { status: 500 });
  }

  if (status === "approved") {
    await attachPaidTicketsToBuyerAccount(localPaymentId);
    if (before.status !== "approved") await notifySaleCompleted(localPaymentId);
  } else if (status === "refunded" && before.status !== "refunded") {
    const { data: ticket } = await admin
      .from("tickets")
      .select("id")
      .eq("payment_id", localPaymentId)
      .maybeSingle();
    if (ticket) await notifySaleRefunded({ paymentId: localPaymentId, ticketId: ticket.id });
  }

  return NextResponse.json({ received: true });
}
