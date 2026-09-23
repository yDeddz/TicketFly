import { describe, expect, it } from "vitest";

import { buildPagarmeSplit } from "@/lib/payments/pagarme-client";
import { matchRecipientByDocument, recipientLinkBlock } from "@/lib/payments/stone-recipient";

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

describe("matchRecipientByDocument", () => {
  const recipients = [
    { id: "rp_platform", document: "00000000000191" },
    { id: "rp_club", document: "499.218.528-25" },
  ];

  it("matches a house profile to the Stone recipient with the same CPF/CNPJ", () => {
    expect(matchRecipientByDocument(recipients, "49921852825")?.id).toBe("rp_club");
  });

  it("returns null when the document does not match", () => {
    expect(matchRecipientByDocument(recipients, "11444777000161")).toBeNull();
  });
});

describe("recipientLinkBlock", () => {
  it("refuses the TicketFly platform recipient", () => {
    expect(
      recipientLinkBlock({ recipientId: "rp_ticketfly", platformRecipientId: "rp_ticketfly", status: "active" })
        ?.code,
    ).toBe("RECIPIENT_PLATFORM");
  });

  it("refuses an inactive Stone recipient", () => {
    expect(recipientLinkBlock({ recipientId: "rp_club", status: "registration" })?.code).toBe("RECIPIENT_INACTIVE");
  });

  it("allows an active house recipient", () => {
    expect(recipientLinkBlock({ recipientId: "rp_club", platformRecipientId: "rp_ticketfly", status: "active" })).toBeNull();
  });
});
