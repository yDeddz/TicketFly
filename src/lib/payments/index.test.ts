import { describe, expect, it } from "vitest";

import { organizerReceivingReady } from "@/lib/organizer-profile";
import { checkoutProviderLabel, resolveCheckoutProvider } from "@/lib/payments";

describe("resolveCheckoutProvider", () => {
  it("uses Pagar.me with an admin-configured recipient", () => {
    const resolved = resolveCheckoutProvider({
      primary_payment_provider: "pagarme",
      pagarme_connection_status: "connected",
      pagarme_recipient_id: "rp_123",
      asaas_connection_status: "disconnected",
      asaas_wallet_id: null,
      mp_access_token: null,
      mp_connection_status: "disconnected",
    });
    expect(resolved.provider).toBe("pagarme");
    expect(resolved.pagarmeRecipientId).toBe("rp_123");
  });

  it("does not fall back when the Pagar.me recipient is missing", () => {
    const resolved = resolveCheckoutProvider({
      primary_payment_provider: "asaas",
      asaas_connection_status: "disconnected",
      asaas_wallet_id: null,
      mp_access_token: null,
      mp_connection_status: "disconnected",
    });
    expect(resolved.provider).toBe("pagarme");
    expect(resolved.pagarmeRecipientId).toBeNull();
  });
});

describe("checkoutProviderLabel", () => {
  it("describes Pagar.me as Pix or card", () => {
    expect(checkoutProviderLabel("pagarme")).toBe("Pix ou cartão");
  });
});

describe("organizerReceivingReady", () => {
  it("requires admin-configured Pagar.me receiving", () => {
    expect(
      organizerReceivingReady({
        pagarme_connection_status: "disconnected",
      }),
    ).toBe(false);
    expect(
      organizerReceivingReady({
        pagarme_connection_status: "connected",
      }),
    ).toBe(true);
  });
});
