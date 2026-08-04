import {
  asaasCreatePayment,
  asaasDueDate,
  asaasFindOrCreateCustomer,
  asaasRefundPayment,
  hasAsaasConfig,
} from "@/lib/payments/asaas-client";
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentProvider } from "@/lib/payments/types";

export const asaasProvider: PaymentProvider = {
  name: "asaas",

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!hasAsaasConfig()) {
      throw new Error("Asaas is not configured");
    }
    if (!input.asaasWalletId) {
      throw new Error("Organizer Asaas wallet missing");
    }

    const customer = await asaasFindOrCreateCustomer({
      name: input.buyerName,
      email: input.buyerEmail,
    });

    const value = input.amountCents / 100;
    const splitFixed = input.netAmountCents / 100;

    const payment = await asaasCreatePayment({
      customer: customer.id,
      billingType: "UNDEFINED",
      value,
      dueDate: asaasDueDate(1),
      description: input.eventTitle.slice(0, 500),
      externalReference: input.paymentId,
      callback: {
        successUrl: input.statusUrl,
        autoRedirect: true,
      },
      ...(splitFixed > 0
        ? {
            split: [
              {
                walletId: input.asaasWalletId,
                fixedValue: Number(splitFixed.toFixed(2)),
                description: "Repasse organizador Ticket Fly",
                externalReference: input.paymentId,
              },
            ],
          }
        : {}),
    });

    const checkoutUrl = payment.invoiceUrl;
    if (!checkoutUrl) {
      throw new Error("Asaas invoice URL missing");
    }

    return {
      provider: "asaas",
      checkoutUrl,
      providerPreferenceId: payment.id,
      providerPaymentId: payment.id,
    };
  },

  async refund(providerPaymentId: string): Promise<boolean> {
    try {
      await asaasRefundPayment(providerPaymentId);
      return true;
    } catch {
      return false;
    }
  },
};
