import { describe, expect, it } from "vitest";

import { checkoutProviderLabel, resolveCheckoutProvider } from "@/lib/payments";

describe("resolveCheckoutProvider", () => {
  it("uses Asaas when it is primary and connected", () => {
    const resolved = resolveCheckoutProvider({
      primary_payment_provider: "asaas",
      asaas_connection_status: "connected",
      asaas_wallet_id: "wal_123",
      mp_access_token: null,
      mp_connection_status: "disconnected",
    });
    expect(resolved.provider).toBe("asaas");
  });

  it("falls back to platform Mercado Pago", () => {
    const resolved = resolveCheckoutProvider({
      primary_payment_provider: "asaas",
      asaas_connection_status: "disconnected",
      asaas_wallet_id: null,
      mp_access_token: null,
      mp_connection_status: "disconnected",
    });
    expect(resolved.provider).toBe("mercado_pago");
    expect(resolved.useMpConnect).toBe(false);
  });
});

describe("checkoutProviderLabel", () => {
  it("describes Asaas as Pix or card", () => {
    expect(checkoutProviderLabel("asaas")).toBe("Pix ou cartão");
  });
});
