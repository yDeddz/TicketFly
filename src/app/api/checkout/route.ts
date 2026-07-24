import { NextResponse } from "next/server";

import { couponErrorMessage } from "@/lib/coupons";
import { appUrl } from "@/lib/env";
import {
  computePurchaseInsurance,
  computeServiceFee,
  splitServiceFee,
  type FeeContract,
} from "@/lib/fees";
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

type OrganizerPayConfig = {
  id: string;
  fee_threshold_cents: number | null;
  fee_percent_upto_threshold: number | null;
  fee_percent_above_threshold: number | null;
  service_fee_platform_share_percent: number | null;
  mp_access_token: string | null;
  mp_connection_status: string | null;
};

type ClaimedCoupon = {
  coupon_id: string;
  discount_cents: number;
  promoter_id: string | null;
};

function rpcErrorCode(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const match = message.match(
    /(coupon_not_found|coupon_inactive|coupon_wrong_event|coupon_wrong_organizer|coupon_not_started|coupon_expired|coupon_exhausted|coupon_no_discount)/,
  );
  return match?.[1];
}

export async function POST(request: Request) {
  const input = checkoutSchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "Dados de compra inválidos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Name/email are collected on Mercado Pago. Prefer session profile when present.
  const buyerName =
    input.data.buyerName?.trim() ||
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") ||
    (typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "") ||
    "Comprador";
  const buyerEmail =
    input.data.buyerEmail?.trim() ||
    user?.email?.trim() ||
    `pending+${crypto.randomUUID().slice(0, 8)}@checkout.ticketfly.app`;

  const admin = createAdminClient();
  const { data: reservationData, error: reservationError } = await admin
    .rpc("reserve_ticket", {
      p_batch_id: input.data.batchId,
      p_buyer_name: buyerName,
      p_buyer_email: buyerEmail,
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

  const { data: eventRow } = await admin
    .from("events")
    .select(
      "id,title,organizer_id,organizers(id,fee_threshold_cents,fee_percent_upto_threshold,fee_percent_above_threshold,service_fee_platform_share_percent,mp_access_token,mp_connection_status)",
    )
    .eq("id", reservation.event_id)
    .single();

  const organizersRaw = eventRow?.organizers as OrganizerPayConfig | OrganizerPayConfig[] | null | undefined;
  const organizer = Array.isArray(organizersRaw) ? organizersRaw[0] : organizersRaw;
  const organizerId = organizer?.id ?? eventRow?.organizer_id;

  let claimed: ClaimedCoupon | null = null;
  let ticketPriceCents = reservation.price_cents;
  let feeCents = reservation.fee_cents;

  const couponCode = input.data.couponCode?.trim();
  if (couponCode && organizerId) {
    const { data: couponRow } = await admin
      .from("coupons")
      .select("id")
      .eq("organizer_id", organizerId)
      .ilike("code", couponCode)
      .maybeSingle();

    if (!couponRow) {
      await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
      return NextResponse.json({ error: "Cupom não encontrado" }, { status: 400 });
    }

    const { data: claimData, error: claimError } = await admin
      .rpc("claim_coupon", {
        p_coupon_id: couponRow.id,
        p_organizer_id: organizerId,
        p_event_id: reservation.event_id,
        p_ticket_price_cents: reservation.price_cents,
      })
      .single();

    if (claimError || !claimData) {
      await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
      return NextResponse.json(
        { error: couponErrorMessage(rpcErrorCode(claimError?.message)) },
        { status: 400 },
      );
    }

    claimed = claimData as ClaimedCoupon;
    ticketPriceCents = Math.max(0, reservation.price_cents - claimed.discount_cents);

    const feeContract: FeeContract = {
      fee_threshold_cents: Number(organizer?.fee_threshold_cents ?? 12_000),
      fee_percent_upto_threshold: Number(organizer?.fee_percent_upto_threshold ?? 12),
      fee_percent_above_threshold: Number(organizer?.fee_percent_above_threshold ?? 9),
      service_fee_platform_share_percent: Number(organizer?.service_fee_platform_share_percent ?? 50),
    };
    feeCents = computeServiceFee(ticketPriceCents, feeContract).feeCents;
  }

  const platformSharePercent = Number(organizer?.service_fee_platform_share_percent ?? 50);
  const { platformShareCents, partnerShareCents } = splitServiceFee(feeCents, platformSharePercent);

  const insuranceSelected = Boolean(input.data.insuranceSelected);
  const insuranceCents = insuranceSelected ? computePurchaseInsurance(ticketPriceCents) : 0;

  const discountCents = claimed?.discount_cents ?? 0;
  const amountCents = ticketPriceCents + feeCents + insuranceCents;
  const netAmountCents = ticketPriceCents + partnerShareCents;
  const marketplaceFeeCents = platformShareCents + insuranceCents;

  const useConnect =
    organizer?.mp_connection_status === "connected" && Boolean(organizer.mp_access_token);

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      user_id: user?.id ?? null,
      event_id: reservation.event_id,
      ticket_batch_id: input.data.batchId,
      amount_cents: amountCents,
      platform_fee_cents: feeCents,
      platform_fee_share_cents: platformShareCents,
      partner_fee_share_cents: partnerShareCents,
      insurance_cents: insuranceCents,
      insurance_selected: insuranceSelected,
      discount_cents: discountCents,
      coupon_id: claimed?.coupon_id ?? null,
      net_amount_cents: netAmountCents,
      status: "pending",
    })
    .select("id")
    .single();

  if (paymentError || !payment) {
    if (claimed) await admin.rpc("release_coupon_claim", { p_coupon_id: claimed.coupon_id });
    await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
    return NextResponse.json({ error: "Erro ao criar pagamento" }, { status: 500 });
  }

  await admin
    .from("tickets")
    .update({
      payment_id: payment.id,
      amount_paid_cents: ticketPriceCents + feeCents,
    })
    .eq("id", reservation.ticket_id);

  if (claimed) {
    await admin.from("coupon_redemptions").insert({
      coupon_id: claimed.coupon_id,
      payment_id: payment.id,
      ticket_id: reservation.ticket_id,
      discount_cents: claimed.discount_cents,
    });
  }

  const attributedPromoterId = reservation.promoter_id ?? claimed?.promoter_id ?? null;
  if (attributedPromoterId) {
    const { data: promoter } = await admin
      .from("promoters")
      .select("commission_percent")
      .eq("id", attributedPromoterId)
      .maybeSingle();
    const commissionPercent = Number(promoter?.commission_percent ?? 5);
    const commissionCents = Math.round((ticketPriceCents * commissionPercent) / 100);
    await admin.from("promoter_sales").insert({
      promoter_id: attributedPromoterId,
      ticket_id: reservation.ticket_id,
      payment_id: payment.id,
      commission_cents: commissionCents,
    });
  }

  const eventTitle = eventRow?.title ?? "Ingresso Ticket Fly";

  const items = [
    {
      id: reservation.ticket_id,
      title: eventTitle,
      quantity: 1,
      currency_id: "BRL" as const,
      unit_price: ticketPriceCents / 100,
    },
    {
      id: `${reservation.ticket_id}-fee`,
      title: "Taxa de serviço",
      quantity: 1,
      currency_id: "BRL" as const,
      unit_price: feeCents / 100,
    },
  ];

  if (insuranceCents > 0) {
    items.push({
      id: `${reservation.ticket_id}-insurance`,
      title: "Seguro de compra",
      quantity: 1,
      currency_id: "BRL" as const,
      unit_price: insuranceCents / 100,
    });
  }

  let preference;

  try {
    const sellerToken = useConnect ? organizer!.mp_access_token! : undefined;
    preference = await preferenceClient(payment.id, sellerToken).create({
      body: {
        external_reference: payment.id,
        notification_url: `${appUrl()}/api/webhooks/mercado-pago?source_news=webhooks`,
        back_urls: {
          success: `${appUrl()}/status/${payment.id}`,
          pending: `${appUrl()}/status/${payment.id}`,
          failure: `${appUrl()}/status/${payment.id}`,
        },
        auto_return: "approved",
        items: items.filter((item) => item.unit_price > 0),
        ...(useConnect && marketplaceFeeCents > 0
          ? { marketplace_fee: marketplaceFeeCents / 100 }
          : {}),
        // Prefill only when we already know the buyer (logged-in). Otherwise MP collects it.
        ...(user?.email
          ? {
              payer: {
                name: buyerName !== "Comprador" ? buyerName : undefined,
                email: user.email,
              },
            }
          : {}),
        metadata: {
          payment_id: payment.id,
          ticket_id: reservation.ticket_id,
          insurance_selected: insuranceSelected,
          platform_fee_share_cents: platformShareCents,
          partner_fee_share_cents: partnerShareCents,
          discount_cents: discountCents,
          coupon_id: claimed?.coupon_id ?? null,
          connect: useConnect,
        },
      },
    });
  } catch {
    if (claimed) await admin.rpc("release_coupon_claim", { p_coupon_id: claimed.coupon_id });
    await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
    await admin.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
    return NextResponse.json({ error: "Erro ao iniciar checkout" }, { status: 502 });
  }

  const checkoutUrl = preference.init_point ?? preference.sandbox_init_point;

  if (!checkoutUrl) {
    if (claimed) await admin.rpc("release_coupon_claim", { p_coupon_id: claimed.coupon_id });
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
    ticketCode: reservation.ticket_code,
    checkoutUrl,
  });
}
