import { hasAsaasConfig } from "@/lib/payments/asaas-client";
import { asaasProvider } from "@/lib/payments/providers/asaas";
import { mercadoPagoProvider } from "@/lib/payments/providers/mercado-pago";
import { pagarmeProvider } from "@/lib/payments/providers/pagarme";
import { hasPagarmeConfig } from "@/lib/payments/pagarme-client";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  OrganizerPaymentConnection,
  PaymentProvider,
  PaymentProviderName,
} from "@/lib/payments/types";

export type { CreateCheckoutInput, CreateCheckoutResult, OrganizerPaymentConnection, PaymentProviderName };
export { hasAsaasConfig };
export { hasPagarmeConfig };
export { organizerReceivingReady } from "@/lib/organizer-profile";

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  if (name === "asaas") return asaasProvider;
  if (name === "pagarme") return pagarmeProvider;
  return mercadoPagoProvider;
}

export function resolveCheckoutProvider(
  organizer: OrganizerPaymentConnection | null | undefined,
): {
  provider: PaymentProviderName;
  useMpConnect: boolean;
  mpAccessToken: string | null;
  asaasWalletId: string | null;
  pagarmeRecipientId: string | null;
} {
  return {
    provider: "pagarme",
    useMpConnect: false,
    mpAccessToken: null,
    asaasWalletId: null,
    pagarmeRecipientId:
      organizer?.pagarme_connection_status === "connected"
        ? organizer.pagarme_recipient_id ?? null
        : null,
  };
}

export function checkoutProviderLabel(provider: PaymentProviderName) {
  return provider === "pagarme" || provider === "asaas" ? "Pix ou cartão" : "checkout seguro";
}

export async function createProviderCheckout(
  organizer: OrganizerPaymentConnection | null | undefined,
  input: Omit<CreateCheckoutInput, "mpAccessToken" | "useMpConnect" | "asaasWalletId" | "pagarmeRecipientId">,
): Promise<CreateCheckoutResult> {
  const resolved = resolveCheckoutProvider(organizer);
  const provider = getPaymentProvider(resolved.provider);

  return provider.createCheckout({
    ...input,
    useMpConnect: resolved.useMpConnect,
    mpAccessToken: resolved.mpAccessToken,
    asaasWalletId: resolved.asaasWalletId,
    pagarmeRecipientId: resolved.pagarmeRecipientId,
  });
}

export async function refundViaProvider(
  providerName: string | null | undefined,
  providerPaymentId: string,
): Promise<boolean> {
  const name: PaymentProviderName =
    providerName === "asaas" || providerName === "pagarme" ? providerName : "mercado_pago";
  return getPaymentProvider(name).refund(providerPaymentId);
}
