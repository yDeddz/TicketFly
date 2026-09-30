import { describe, expect, it } from "vitest";

import {
  computePurchaseInsurance,
  computeServiceFee,
  DEFAULT_FEE_CONTRACT,
  splitAfterStone,
  splitServiceFee,
  stoneProcessingCents,
} from "@/lib/fees";

describe("computeServiceFee", () => {
  it("applies 12% up to the threshold", () => {
    const fee = computeServiceFee(10_000, DEFAULT_FEE_CONTRACT);
    expect(fee.feePercent).toBe(12);
    expect(fee.feeCents).toBe(1_200);
    expect(fee.totalCents).toBe(11_200);
  });

  it("applies 12% above the threshold", () => {
    const fee = computeServiceFee(20_000, DEFAULT_FEE_CONTRACT);
    expect(fee.feePercent).toBe(12);
    expect(fee.feeCents).toBe(2_400);
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

describe("splitAfterStone", () => {
  it("subtracts Pix from the service fee before the 50/50 and keeps insurance with TicketFly", () => {
    const ticket = 10_000;
    const fee = 1_200;
    const insurance = 499;
    const amount = ticket + fee + insurance;
    const stone = stoneProcessingCents(amount, "pix");
    const split = splitAfterStone({
      ticketPriceCents: ticket,
      feeCents: fee,
      insuranceCents: insurance,
      stoneCents: stone,
    });

    expect(stone).toBe(116);
    expect(split.platformShareCents + split.partnerShareCents).toBe(fee - stone);
    expect(split.organizerAmountCents).toBe(ticket + split.partnerShareCents);
    expect(split.platformAmountCents).toBe(split.platformShareCents + insurance + stone);
    expect(split.ticketRefundCents).toBe(ticket);
    expect(split.organizerAmountCents + split.platformAmountCents).toBe(amount);
  });

  it("subtracts card MDR plus antifraud before the 50/50", () => {
    const ticket = 10_000;
    const fee = 1_200;
    const insurance = 499;
    const amount = ticket + fee + insurance;
    const stone = stoneProcessingCents(amount, "credit_card");
    const split = splitAfterStone({
      ticketPriceCents: ticket,
      feeCents: fee,
      insuranceCents: insurance,
      stoneCents: stone,
    });

    expect(stone).toBe(483);
    expect(split.platformShareCents + split.partnerShareCents).toBe(fee - stone);
    expect(split.platformAmountCents).toBe(split.platformShareCents + insurance + stone);
    expect(split.organizerAmountCents + split.platformAmountCents).toBe(amount);
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
