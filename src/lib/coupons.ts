export type CouponDiscountType = "percent" | "fixed";

export type CouponLike = {
  discount_type: CouponDiscountType;
  discount_value: number;
};

/** Discount applied to ticket price only (never exceeds price). */
export function computeCouponDiscountCents(priceCents: number, coupon: CouponLike): number {
  if (priceCents <= 0) return 0;

  if (coupon.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(coupon.discount_value)));
    return Math.min(priceCents, Math.round((priceCents * pct) / 100));
  }

  const fixed = Math.max(0, Math.round(Number(coupon.discount_value)));
  return Math.min(priceCents, fixed);
}

export function couponErrorMessage(code: string | undefined): string {
  switch (code) {
    case "coupon_not_found":
      return "Cupom não encontrado";
    case "coupon_inactive":
      return "Cupom inativo";
    case "coupon_wrong_event":
      return "Cupom não vale para este evento";
    case "coupon_wrong_organizer":
      return "Cupom inválido para esta organização";
    case "coupon_not_started":
      return "Cupom ainda não está válido";
    case "coupon_expired":
      return "Cupom expirado";
    case "coupon_exhausted":
      return "Cupom esgotado";
    case "coupon_no_discount":
      return "Cupom sem desconto aplicável";
    default:
      return "Não foi possível aplicar o cupom";
  }
}
