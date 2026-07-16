import { NextResponse } from "next/server";

import { paymentClient, verifyMercadoPagoSignature } from "@/lib/mercado-pago";
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

  const providerPayment = await paymentClient().get({ id: paymentId });
  const localPaymentId =
    providerPayment.external_reference ??
    providerPayment.metadata?.payment_id ??
    providerPayment.additional_info?.items?.[0]?.id;

  if (!localPaymentId) {
    return NextResponse.json({ error: "Referência local ausente" }, { status: 202 });
  }

  const admin = createAdminClient();
  await admin.rpc("apply_payment_status", {
    p_payment_id: localPaymentId,
    p_status: mapPaymentStatus(providerPayment.status),
    p_provider_payment_id: String(providerPayment.id),
    p_payload: providerPayment,
  });

  return NextResponse.json({ received: true });
}
