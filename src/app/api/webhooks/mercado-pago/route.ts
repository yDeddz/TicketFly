import { NextResponse } from "next/server";

import { paymentClient, verifyMercadoPagoSignature } from "@/lib/mercado-pago";
import { notifySaleCompleted, notifySaleRefunded } from "@/lib/organizer-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

type MercadoPagoWebhook = {
  type?: string;
  action?: string;
  data?: {
    id?: string;
  };
};

function mapPaymentStatus(status?: string) {
  if (status === "approved") return "approved";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded" || status === "charged_back") return "refunded";
  if (status === "rejected") return "rejected";
  return "pending";
}

export async function POST(request: Request) {
  const body = (await request.json()) as MercadoPagoWebhook;
  const paymentId = body.data?.id ?? new URL(request.url).searchParams.get("data.id");

  const validSignature = verifyMercadoPagoSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId: paymentId,
  });

  if (!validSignature) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  if (!paymentId || body.type !== "payment") {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  let providerPayment;

  try {
    providerPayment = await paymentClient().get({ id: paymentId });
  } catch {
    // Marketplace Connect: payment may only be readable with the seller token.
    const { data: organizers } = await admin
      .from("organizers")
      .select("mp_access_token")
      .eq("mp_connection_status", "connected")
      .not("mp_access_token", "is", null)
      .limit(50);

    for (const organizer of organizers ?? []) {
      if (!organizer.mp_access_token) continue;
      try {
        providerPayment = await paymentClient(organizer.mp_access_token).get({ id: paymentId });
        break;
      } catch {
        // try next seller
      }
    }
  }

  if (!providerPayment) {
    return NextResponse.json({ error: "Pagamento Mercado Pago não encontrado" }, { status: 202 });
  }

  const localPaymentId =
    providerPayment.external_reference ??
    providerPayment.metadata?.payment_id ??
    providerPayment.additional_info?.items?.[0]?.id;

  if (!localPaymentId) {
    return NextResponse.json({ error: "Referência local ausente" }, { status: 202 });
  }

  const mappedStatus = mapPaymentStatus(providerPayment.status);

  const { data: before } = await admin
    .from("payments")
    .select("id,status")
    .eq("id", localPaymentId)
    .maybeSingle();

  await admin.rpc("apply_payment_status", {
    p_payment_id: localPaymentId,
    p_status: mappedStatus,
    p_provider_payment_id: String(providerPayment.id),
    p_payload: providerPayment,
  });

  const payerEmail =
    typeof providerPayment.payer?.email === "string" ? providerPayment.payer.email.trim() : "";
  const payerFirst =
    typeof providerPayment.payer?.first_name === "string" ? providerPayment.payer.first_name.trim() : "";
  const payerLast =
    typeof providerPayment.payer?.last_name === "string" ? providerPayment.payer.last_name.trim() : "";
  const payerName = [payerFirst, payerLast].filter(Boolean).join(" ").trim();

  if (payerEmail || payerName) {
    const ticketPatch: { buyer_email?: string; buyer_name?: string } = {};
    if (payerEmail) ticketPatch.buyer_email = payerEmail;
    if (payerName) ticketPatch.buyer_name = payerName;

    await admin.from("tickets").update(ticketPatch).eq("payment_id", localPaymentId);
  }

  if (mappedStatus === "approved" && before?.status !== "approved") {
    await notifySaleCompleted(String(localPaymentId));
  }

  if (mappedStatus === "refunded" && before?.status !== "refunded") {
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
