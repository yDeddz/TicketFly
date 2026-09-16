import {
  hasPagarmeConfig,
  pagarmeCreateCheckout,
  pagarmeRefundCharge,
} from "@/lib/payments/pagarme-client";
import type { CreateCheckoutResult, PaymentProvider } from "@/lib/payments/types";

export const pagarmeProvider: PaymentProvider = {
  name: "pagarme",

  async createCheckout(input): Promise<CreateCheckoutResult> {
    if (!hasPagarmeConfig()) throw new Error("Pagar.me is not configured");
    if (!input.pagarmeRecipientId) throw new Error("Organizer Pagar.me recipient missing");

    const { order, checkoutUrl } = await pagarmeCreateCheckout({
      paymentId: input.paymentId,
      ticketId: input.ticketId,
      eventTitle: input.eventTitle,
      amountCents: input.amountCents,
      organizerAmountCents: input.netAmountCents,
      organizerRecipientId: input.pagarmeRecipientId,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      statusUrl: input.statusUrl,
      metadata: input.metadata,
    });

    return {
      provider: "pagarme",
      checkoutUrl,
      providerPreferenceId: order.id,
      providerPaymentId: order.charges?.[0]?.id ?? null,
    };
  },

  async refund(providerPaymentId): Promise<boolean> {
    try {
      await pagarmeRefundCharge(providerPaymentId);
      return true;
    } catch {
      return false;
    }
  },
};
