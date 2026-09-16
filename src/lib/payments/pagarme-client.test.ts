import { describe, expect, it } from "vitest";

import { buildPagarmeSplit } from "@/lib/payments/pagarme-client";

describe("buildPagarmeSplit", () => {
  it("sends ticket plus 6% to the organizer and the other 6% to TicketFly", () => {
    const split = buildPagarmeSplit({
      amountCents: 11_200,
      organizerAmountCents: 10_600,
      organizerRecipientId: "rp_club",
      platformRecipientId: "rp_ticketfly",
    });

    expect(split.map(({ amount, recipient_id }) => ({ amount, recipient_id }))).toEqual([
      { amount: 10_600, recipient_id: "rp_club" },
      { amount: 600, recipient_id: "rp_ticketfly" },
    ]);
    expect(split.reduce((sum, rule) => sum + rule.amount, 0)).toBe(11_200);
  });
});
