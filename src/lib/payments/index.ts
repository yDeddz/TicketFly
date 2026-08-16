import { hasAsaasConfig } from "@/lib/payments/asaas-client";
import { asaasProvider } from "@/lib/payments/providers/asaas";
import { mercadoPagoProvider } from "@/lib/payments/providers/mercado-pago";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  OrganizerPaymentConnection,
  PaymentProvider,
  PaymentProviderName,
} from "@/lib/payments/types";

export type { CreateCheckoutInput, CreateCheckoutResult, OrganizerPaymentConnection, PaymentProviderName };
export { hasAsaasConfig };

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  if (name === "asaas") return asaasProvider;
  return mercadoPagoProvider;
}

/**
 * Organizer picks one primary provider (model A).
 * If that provider is not connected, fall back to Mercado Pago (Connect when available, else platform).
 */
export function resolveCheckoutProvider(
  organizer: OrganizerPaymentConnection | null | undefined,
): {
  provider: PaymentProviderName;
  useMpConnect: boolean;
  mpAccessToken: string | null;
  asaasWalletId: string | null;
} {
  const asaasReady =
    organizer?.asaas_connection_status === "connected" && Boolean(organizer.asaas_wallet_id);

  const mpReady =
    organizer?.mp_connection_status === "connected" && Boolean(organizer.mp_access_token);

  const primary = organizer?.primary_payment_provider === "asaas" ? "asaas" : "mercado_pago";

  if (primary === "asaas" && asaasReady) {
    return {
      provider: "asaas",
      useMpConnect: false,
      mpAccessToken: null,
      asaasWalletId: organizer!.asaas_wallet_id!,
    };
  }

  if (mpReady) {
    return {
      provider: "mercado_pago",
      useMpConnect: true,
      mpAccessToken: organizer!.mp_access_token!,
      asaasWalletId: null,
    };
  }

  // Platform Mercado Pago fallback (no Connect).
  return {
    provider: "mercado_pago",
    useMpConnect: false,
    mpAccessToken: null,
    asaasWalletId: null,
  };
}

export function checkoutProviderLabel(provider: PaymentProviderName) {
  return provider === "asaas" ? "Pix ou cartão" : "checkout seguro";
}

export async function createProviderCheckout(
  organizer: OrganizerPaymentConnection | null | undefined,
  input: Omit<CreateCheckoutInput, "mpAccessToken" | "useMpConnect" | "asaasWalletId">,
): Promise<CreateCheckoutResult> {
  const resolved = resolveCheckoutProvider(organizer);
  const provider = getPaymentProvider(resolved.provider);

  return provider.createCheckout({
    ...input,
    useMpConnect: resolved.useMpConnect,
    mpAccessToken: resolved.mpAccessToken,
    asaasWalletId: resolved.asaasWalletId,
  });
}

export async function refundViaProvider(
  providerName: string | null | undefined,
  providerPaymentId: string,
): Promise<boolean> {
  const name: PaymentProviderName = providerName === "asaas" ? "asaas" : "mercado_pago";
  return getPaymentProvider(name).refund(providerPaymentId);
}
