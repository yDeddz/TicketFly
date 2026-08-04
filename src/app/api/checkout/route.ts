import { NextResponse } from "next/server";

import { couponErrorMessage } from "@/lib/coupons";
import { appUrl } from "@/lib/env";
import {
  computePurchaseInsurance,
  computeServiceFee,
  splitServiceFee,
  type FeeContract,
} from "@/lib/fees";
import { createProviderCheckout, resolveCheckoutProvider } from "@/lib/payments";
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
  primary_payment_provider: string | null;
  mp_access_token: string | null;
  mp_connection_status: string | null;
  asaas_wallet_id: string | null;
  asaas_connection_status: string | null;
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

  // Name/email collected on provider checkout when missing. Prefer session profile when present.
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
      "id,title,organizer_id,organizers(id,fee_threshold_cents,fee_percent_upto_threshold,fee_percent_above_threshold,service_fee_platform_share_percent,primary_payment_provider,mp_access_token,mp_connection_status,asaas_wallet_id,asaas_connection_status)",
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
  const resolvedProvider = resolveCheckoutProvider(organizer);

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
      provider: resolvedProvider.provider,
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

  const statusUrl = `${appUrl()}/status/${payment.id}`;

  // Free tickets (R$0 total): skip provider and approve immediately.
  if (amountCents === 0) {
    const { error: freeApproveError } = await admin.rpc("apply_payment_status", {
      p_payment_id: payment.id,
      p_status: "approved",
      p_provider_payment_id: `free_${payment.id}`,
      p_payload: { source: "free_checkout", ticket_id: reservation.ticket_id },
    });

    if (freeApproveError) {
      if (claimed) await admin.rpc("release_coupon_claim", { p_coupon_id: claimed.coupon_id });
      await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
      await admin.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
      return NextResponse.json({ error: "Erro ao liberar ingresso gratuito" }, { status: 500 });
    }

    await admin.from("payments").update({ checkout_url: statusUrl }).eq("id", payment.id);

    return NextResponse.json({
      paymentId: payment.id,
      ticketCode: reservation.ticket_code,
      checkoutUrl: statusUrl,
      free: true,
    });
  }

  const eventTitle = eventRow?.title ?? "Ingresso Ticket Fly";

  let checkout;

  try {
    checkout = await createProviderCheckout(organizer, {
      paymentId: payment.id,
      ticketId: reservation.ticket_id,
      eventTitle,
      amountCents,
      ticketPriceCents,
      feeCents,
      insuranceCents,
      netAmountCents,
      marketplaceFeeCents,
      buyerName,
      buyerEmail,
      buyerUserEmail: user?.email ?? null,
      statusUrl,
      metadata: {
        payment_id: payment.id,
        ticket_id: reservation.ticket_id,
        insurance_selected: insuranceSelected,
        platform_fee_share_cents: platformShareCents,
        partner_fee_share_cents: partnerShareCents,
        discount_cents: discountCents,
        coupon_id: claimed?.coupon_id ?? null,
      },
    });
  } catch {
    if (claimed) await admin.rpc("release_coupon_claim", { p_coupon_id: claimed.coupon_id });
    await admin.rpc("release_reserved_ticket", { p_ticket_id: reservation.ticket_id });
    await admin.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
    return NextResponse.json({ error: "Erro ao iniciar checkout" }, { status: 502 });
  }

  await admin
    .from("payments")
    .update({
      provider: checkout.provider,
      provider_preference_id: checkout.providerPreferenceId ?? null,
      provider_payment_id: checkout.providerPaymentId ?? null,
      checkout_url: checkout.checkoutUrl,
    })
    .eq("id", payment.id);

  return NextResponse.json({
    paymentId: payment.id,
    ticketCode: reservation.ticket_code,
    checkoutUrl: checkout.checkoutUrl,
    provider: checkout.provider,
  });
}
