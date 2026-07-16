import { NextResponse } from "next/server";

import { appUrl } from "@/lib/env";
import { preferenceClient } from "@/lib/mercado-pago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/validators";

type Reservation = {
  ticket_id: string;
  ticket_code: string;
  qr_token: string;
  event_id: string;
  price_cents: number;
  fee_cents: number;
  promoter_id: string | null;
};

export async function POST(request: Request) {
  const input = checkoutSchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "Dados de compra inválidos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: reservationData, error: reservationError } = await admin
    .rpc("reserve_ticket", {
      p_batch_id: input.data.batchId,
      p_buyer_name: input.data.buyerName,
      p_buyer_email: input.data.buyerEmail,
      p_buyer_user_id: user?.id ?? null,
      p_promoter_code: input.data.promoterCode || null,
    })
    .single();
  const reservation = reservationData as Reservation | null;

  if (reservationError || !reservation) {
    return NextResponse.json(
      { error: reservationError?.message ?? "Não foi possível reservar o ingresso" },
      { status: 409 },
    );
  }

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      user_id: user?.id ?? null,
      event_id: reservation.event_id,
      ticket_batch_id: input.data.batchId,
      amount_cents: reservation.price_cents,
      platform_fee_cents: reservation.fee_cents,
      net_amount_cents: reservation.price_cents - reservation.fee_cents,
      status: "pending",
    })
    .select("id")
    .single();

  if (paymentError || !payment) {
    await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
    return NextResponse.json({ error: "Erro ao criar pagamento" }, { status: 500 });
  }

  await admin.from("tickets").update({ payment_id: payment.id }).eq("id", reservation.ticket_id);

  if (reservation.promoter_id) {
    const commissionCents = Math.round(reservation.price_cents * 0.05);
    await admin.from("promoter_sales").insert({
      promoter_id: reservation.promoter_id,
      ticket_id: reservation.ticket_id,
      payment_id: payment.id,
      commission_cents: commissionCents,
    });
  }

  const { data: ticket } = await admin
    .from("tickets")
    .select("code, events(title)")
    .eq("id", reservation.ticket_id)
    .single();
  const ticketEvent = Array.isArray(ticket?.events) ? ticket?.events[0] : ticket?.events;

  let preference;

  try {
    preference = await preferenceClient(payment.id).create({
      body: {
        external_reference: payment.id,
        notification_url: `${appUrl()}/api/webhooks/mercado-pago?source_news=webhooks`,
        back_urls: {
          success: `${appUrl()}/status/${payment.id}`,
          pending: `${appUrl()}/status/${payment.id}`,
          failure: `${appUrl()}/status/${payment.id}`,
        },
        auto_return: "approved",
        items: [
          {
            id: reservation.ticket_id,
            title: ticketEvent?.title ?? "Ingresso PinkPass",
            quantity: 1,
            currency_id: "BRL",
            unit_price: reservation.price_cents / 100,
          },
        ],
        payer: {
          name: input.data.buyerName,
          email: input.data.buyerEmail,
        },
        metadata: {
          payment_id: payment.id,
          ticket_id: reservation.ticket_id,
        },
      },
    });
  } catch {
    await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
    await admin.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
    return NextResponse.json({ error: "Erro ao iniciar checkout" }, { status: 502 });
  }

  const checkoutUrl = preference.init_point ?? preference.sandbox_init_point;

  if (!checkoutUrl) {
    await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
    await admin.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
    return NextResponse.json({ error: "Checkout indisponível" }, { status: 502 });
  }

  await admin
    .from("payments")
    .update({
      provider_preference_id: preference.id,
      checkout_url: checkoutUrl,
    })
    .eq("id", payment.id);

  return NextResponse.json({
    paymentId: payment.id,
    ticketCode: ticket?.code,
    checkoutUrl,
  });
}
