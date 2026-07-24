export type FeeContract = {
  fee_threshold_cents: number;
  fee_percent_upto_threshold: number;
  fee_percent_above_threshold: number;
  /** % of service fee kept by Ticket Fly (0–100). Partner gets the rest. */
  service_fee_platform_share_percent?: number;
};

export type ServiceFeeBreakdown = {
  feePercent: number;
  feeCents: number;
  totalCents: number;
  netCents: number;
  platformShareCents: number;
  partnerShareCents: number;
};

export type FeeShareSplit = {
  platformShareCents: number;
  partnerShareCents: number;
};

export const DEFAULT_FEE_CONTRACT: FeeContract = {
  fee_threshold_cents: 12_000,
  fee_percent_upto_threshold: 12,
  fee_percent_above_threshold: 9,
  service_fee_platform_share_percent: 50,
};

/** Purchase insurance (upsell): R$4.99 up to threshold, R$8.99 above. */
export const INSURANCE_THRESHOLD_CENTS = 12_000;
export const INSURANCE_UPTO_THRESHOLD_CENTS = 499;
export const INSURANCE_ABOVE_THRESHOLD_CENTS = 899;

export function resolveFeePercent(priceCents: number, contract: FeeContract = DEFAULT_FEE_CONTRACT): number {
  if (priceCents <= contract.fee_threshold_cents) {
    return contract.fee_percent_upto_threshold;
  }

  return contract.fee_percent_above_threshold;
}

export function splitServiceFee(
  feeCents: number,
  platformSharePercent: number = DEFAULT_FEE_CONTRACT.service_fee_platform_share_percent ?? 50,
): FeeShareSplit {
  const clamped = Math.min(100, Math.max(0, platformSharePercent));
  const platformShareCents = Math.round((feeCents * clamped) / 100);
  return {
    platformShareCents,
    partnerShareCents: feeCents - platformShareCents,
  };
}

export function computePurchaseInsurance(
  priceCents: number,
  thresholdCents: number = INSURANCE_THRESHOLD_CENTS,
): number {
  return priceCents <= thresholdCents ? INSURANCE_UPTO_THRESHOLD_CENTS : INSURANCE_ABOVE_THRESHOLD_CENTS;
}

export function computeServiceFee(
  priceCents: number,
  contract: FeeContract = DEFAULT_FEE_CONTRACT,
): ServiceFeeBreakdown {
  const feePercent = resolveFeePercent(priceCents, contract);
  const feeCents = Math.round((priceCents * feePercent) / 100);
  const share = splitServiceFee(feeCents, contract.service_fee_platform_share_percent ?? 50);

  return {
    feePercent,
    feeCents,
    totalCents: priceCents + feeCents,
    netCents: priceCents,
    platformShareCents: share.platformShareCents,
    partnerShareCents: share.partnerShareCents,
  };
}
