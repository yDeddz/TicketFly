import { appUrl } from "@/lib/env";
import { paymentClient, preferenceClient } from "@/lib/mercado-pago";
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentProvider } from "@/lib/payments/types";

export const mercadoPagoProvider: PaymentProvider = {
  name: "mercado_pago",

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const items = [
      {
        id: input.ticketId,
        title: input.eventTitle,
        quantity: 1,
        currency_id: "BRL" as const,
        unit_price: input.ticketPriceCents / 100,
      },
      {
        id: `${input.ticketId}-fee`,
        title: "Taxa de serviço",
        quantity: 1,
        currency_id: "BRL" as const,
        unit_price: input.feeCents / 100,
      },
    ];

    if (input.insuranceCents > 0) {
      items.push({
        id: `${input.ticketId}-insurance`,
        title: "Seguro de compra",
        quantity: 1,
        currency_id: "BRL" as const,
        unit_price: input.insuranceCents / 100,
      });
    }

    const useConnect = Boolean(input.useMpConnect && input.mpAccessToken);
    const sellerToken = useConnect ? input.mpAccessToken! : undefined;

    const preference = await preferenceClient(input.paymentId, sellerToken).create({
      body: {
        external_reference: input.paymentId,
        notification_url: `${appUrl()}/api/webhooks/mercado-pago?source_news=webhooks`,
        back_urls: {
          success: input.statusUrl,
          pending: input.statusUrl,
          failure: input.statusUrl,
        },
        auto_return: "approved",
        items: items.filter((item) => item.unit_price > 0),
        ...(useConnect && input.marketplaceFeeCents > 0
          ? { marketplace_fee: input.marketplaceFeeCents / 100 }
          : {}),
        ...(input.buyerUserEmail
          ? {
              payer: {
                name: input.buyerName !== "Comprador" ? input.buyerName : undefined,
                email: input.buyerUserEmail,
              },
            }
          : {}),
        metadata: {
          ...input.metadata,
          connect: useConnect,
        },
      },
    });

    const checkoutUrl = preference.init_point ?? preference.sandbox_init_point;
    if (!checkoutUrl) {
      throw new Error("Mercado Pago checkout URL missing");
    }

    return {
      provider: "mercado_pago",
      checkoutUrl,
      providerPreferenceId: preference.id ?? null,
      providerPaymentId: null,
    };
  },

  async refund(providerPaymentId: string): Promise<boolean> {
    try {
      const client = paymentClient() as unknown as {
        refund: (payload: { id: string | number }) => Promise<unknown>;
      };
      await client.refund({ id: providerPaymentId });
      return true;
    } catch {
      return false;
    }
  },
};
