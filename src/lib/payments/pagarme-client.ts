import { timingSafeEqual } from "node:crypto";

import { appUrl, env } from "@/lib/env";
import type { LocalPaymentStatus } from "@/lib/payments/types";

const DEFAULT_API_URL = "https://api.pagar.me/core/v5";

export type PagarmeOrder = {
  id: string;
  status?: string;
  amount?: number;
  code?: string;
  metadata?: Record<string, unknown>;
  checkouts?: Array<{ payment_url?: string }>;
  charges?: Array<{ id: string; status?: string; amount?: number }>;
};

export class PagarmeRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PagarmeRequestError";
  }
}

export function hasPagarmeConfig() {
  return Boolean(
    process.env.PAGARME_SECRET_KEY?.startsWith("sk_") &&
      process.env.PAGARME_PLATFORM_RECIPIENT_ID?.startsWith("rp_"),
  );
}

export function buildPagarmeSplit(args: {
  amountCents: number;
  organizerAmountCents: number;
  organizerRecipientId: string;
  platformRecipientId: string;
}) {
  const platformAmountCents = args.amountCents - args.organizerAmountCents;
  if (platformAmountCents < 0) throw new Error("Invalid Pagar.me split");

  return [
    {
      amount: args.organizerAmountCents,
      recipient_id: args.organizerRecipientId,
      type: "flat",
      options: {
        charge_processing_fee: false,
        charge_remainder_fee: false,
        liable: true,
      },
    },
    {
      amount: platformAmountCents,
      recipient_id: args.platformRecipientId,
      type: "flat",
      options: {
        charge_processing_fee: true,
        charge_remainder_fee: true,
        liable: true,
      },
    },
  ].filter((rule) => rule.amount > 0);
}

async function pagarmeFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = env("PAGARME_SECRET_KEY");
  const response = await fetch(
    `${(process.env.PAGARME_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "")}${path}`,
    {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; errors?: Record<string, string[]> }
      | null;
    throw new PagarmeRequestError(
      response.status,
      payload?.message ?? "Falha no provedor de pagamento",
    );
  }

  return (await response.json()) as T;
}

export async function pagarmeCreateCheckout(args: {
  paymentId: string;
  ticketId: string;
  eventTitle: string;
  amountCents: number;
  organizerAmountCents: number;
  organizerRecipientId: string;
  buyerName: string;
  buyerEmail: string;
  statusUrl: string;
  metadata: Record<string, unknown>;
}) {
  const platformRecipientId = env("PAGARME_PLATFORM_RECIPIENT_ID");
  const split = buildPagarmeSplit({
    amountCents: args.amountCents,
    organizerAmountCents: args.organizerAmountCents,
    organizerRecipientId: args.organizerRecipientId,
    platformRecipientId,
  });

  const order = await pagarmeFetch<PagarmeOrder>("/orders", {
    method: "POST",
    headers: { "Idempotency-Key": args.paymentId },
    body: JSON.stringify({
      code: args.paymentId,
      closed: true,
      items: [
        {
          amount: args.amountCents,
          description: args.eventTitle.slice(0, 255),
          quantity: 1,
          code: args.ticketId,
        },
      ],
      customer: {
        name: args.buyerName,
        email: args.buyerEmail,
        type: "individual",
      },
      payments: [
        {
          payment_method: "checkout",
          checkout: {
            expires_in: 1800,
            customer_editable: true,
            billing_address_editable: true,
            accepted_payment_methods: ["pix", "credit_card"],
            success_url: args.statusUrl,
            skip_checkout_success_page: false,
            pix: { expires_in: 1800 },
            credit_card: {
              capture: true,
              installments: [{ number: 1, total: args.amountCents }],
            },
          },
          split,
        },
      ],
      metadata: args.metadata,
    }),
  });

  const checkoutUrl = order.checkouts?.[0]?.payment_url;
  if (!checkoutUrl) throw new Error("Pagar.me checkout URL missing");
  return { order, checkoutUrl };
}

export async function pagarmeRefundCharge(chargeId: string) {
  return pagarmeFetch(`/charges/${encodeURIComponent(chargeId)}`, {
    method: "DELETE",
  });
}

export function mapPagarmeStatus(status?: string): LocalPaymentStatus {
  switch (status) {
    case "paid":
      return "approved";
    case "failed":
      return "rejected";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "refunded":
    case "chargedback":
      return "refunded";
    default:
      return "pending";
  }
}

export function verifyPagarmeWebhookSecret(value: string | null) {
  const expected = process.env.PAGARME_WEBHOOK_SECRET;
  if (!expected || !value) return false;
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function pagarmeWebhookUrl() {
  return `${appUrl()}/api/webhooks/pagarme`;
}
