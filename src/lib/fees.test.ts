import { describe, expect, it } from "vitest";

import {
  computePurchaseInsurance,
  computeServiceFee,
  DEFAULT_FEE_CONTRACT,
  splitServiceFee,
} from "@/lib/fees";

describe("computeServiceFee", () => {
  it("applies 12% up to the threshold", () => {
    const fee = computeServiceFee(10_000, DEFAULT_FEE_CONTRACT);
    expect(fee.feePercent).toBe(12);
    expect(fee.feeCents).toBe(1_200);
    expect(fee.totalCents).toBe(11_200);
  });

  it("applies 9% above the threshold", () => {
    const fee = computeServiceFee(20_000, DEFAULT_FEE_CONTRACT);
    expect(fee.feePercent).toBe(9);
    expect(fee.feeCents).toBe(1_800);
  });
});

describe("splitServiceFee", () => {
  it("splits 50/50 by default", () => {
    expect(splitServiceFee(1_200)).toEqual({
      platformShareCents: 600,
      partnerShareCents: 600,
    });
  });
});

describe("computePurchaseInsurance", () => {
  it("charges R$4.99 up to the threshold", () => {
    expect(computePurchaseInsurance(8_000)).toBe(499);
  });

  it("charges R$8.99 above the threshold", () => {
    expect(computePurchaseInsurance(15_000)).toBe(899);
  });
});
