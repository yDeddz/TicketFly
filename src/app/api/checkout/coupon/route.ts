import { NextResponse } from "next/server";

import { computeCouponDiscountCents, couponErrorMessage } from "@/lib/coupons";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");
  const code = searchParams.get("code")?.trim();

  if (!batchId || !code) {
    return NextResponse.json({ error: "Informe lote e cupom" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: batch } = await admin
    .from("ticket_batches")
    .select("id,price_cents,event_id")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) {
    return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  }

  const { data: event } = await admin
    .from("events")
    .select("id,organizer_id,status")
    .eq("id", batch.event_id)
    .maybeSingle();

  if (!event || event.status !== "published") {
    return NextResponse.json({ error: "Evento indisponível" }, { status: 400 });
  }

  const { data: coupon } = await admin
    .from("coupons")
    .select("id,code,discount_type,discount_value,event_id,is_active,starts_at,ends_at,max_uses,uses_count")
    .eq("organizer_id", event.organizer_id)
    .ilike("code", code)
    .maybeSingle();

  if (!coupon) {
    return NextResponse.json({ error: "Cupom não encontrado" }, { status: 404 });
  }

  if (!coupon.is_active) {
    return NextResponse.json({ error: couponErrorMessage("coupon_inactive") }, { status: 400 });
  }
  if (coupon.event_id && coupon.event_id !== event.id) {
    return NextResponse.json({ error: couponErrorMessage("coupon_wrong_event") }, { status: 400 });
  }
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
    return NextResponse.json({ error: couponErrorMessage("coupon_not_started") }, { status: 400 });
  }
  if (coupon.ends_at && new Date(coupon.ends_at) < new Date()) {
    return NextResponse.json({ error: couponErrorMessage("coupon_expired") }, { status: 400 });
  }
  if (coupon.max_uses != null && coupon.uses_count >= coupon.max_uses) {
    return NextResponse.json({ error: couponErrorMessage("coupon_exhausted") }, { status: 400 });
  }

  const discountCents = computeCouponDiscountCents(batch.price_cents, {
    discount_type: coupon.discount_type,
    discount_value: Number(coupon.discount_value),
  });

  return NextResponse.json({
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    discountCents,
    priceCents: batch.price_cents,
    priceAfterDiscountCents: Math.max(0, batch.price_cents - discountCents),
  });
}
