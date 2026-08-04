import { NextResponse } from "next/server";

import {
  mapAsaasPaymentStatus,
  verifyAsaasWebhookToken,
  type AsaasWebhookPayload,
} from "@/lib/payments/asaas-client";
import { notifySaleCompleted, notifySaleRefunded } from "@/lib/organizer-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const token =
    request.headers.get("asaas-access-token") ??
    request.headers.get("access_token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (!verifyAsaasWebhookToken(token)) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const body = (await request.json()) as AsaasWebhookPayload;
  const payment = body.payment;

  if (!payment?.id) {
    return NextResponse.json({ received: true });
  }

  const localPaymentId = payment.externalReference;
  if (!localPaymentId) {
    return NextResponse.json({ error: "Referência local ausente" }, { status: 202 });
  }

  const event = body.event ?? "";
  let mappedStatus = mapAsaasPaymentStatus(payment.status);

  if (event === "PAYMENT_DELETED") {
    mappedStatus = "cancelled";
  } else if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_PARTIALLY_REFUNDED") {
    mappedStatus = "refunded";
  } else if (
    event === "PAYMENT_RECEIVED" ||
    event === "PAYMENT_CONFIRMED" ||
    event === "PAYMENT_RECEIVED_IN_CASH"
  ) {
    mappedStatus = "approved";
  } else if (event === "PAYMENT_OVERDUE") {
    mappedStatus = "cancelled";
  }

  const admin = createAdminClient();

  const { data: before } = await admin
    .from("payments")
    .select("id,status")
    .eq("id", localPaymentId)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "Pagamento local não encontrado" }, { status: 202 });
  }

  await admin.rpc("apply_payment_status", {
    p_payment_id: localPaymentId,
    p_status: mappedStatus,
    p_provider_payment_id: String(payment.id),
    p_payload: body,
  });

  if (mappedStatus === "approved" && before.status !== "approved") {
    await notifySaleCompleted(String(localPaymentId));
  }

  if (mappedStatus === "refunded" && before.status !== "refunded") {
    const { data: ticket } = await admin
      .from("tickets")
      .select("id")
      .eq("payment_id", localPaymentId)
      .maybeSingle();

    if (ticket) {
      await notifySaleRefunded({ paymentId: String(localPaymentId), ticketId: ticket.id });
    }
  }

  return NextResponse.json({ received: true });
}
