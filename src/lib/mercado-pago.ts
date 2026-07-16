import crypto from "node:crypto";

import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

import { env } from "@/lib/env";

export function mercadoPagoClient(idempotencyKey?: string) {
  return new MercadoPagoConfig({
    accessToken: env("MERCADO_PAGO_ACCESS_TOKEN"),
    options: {
      timeout: 8000,
      idempotencyKey,
    },
  });
}

export function preferenceClient(idempotencyKey?: string) {
  return new Preference(mercadoPagoClient(idempotencyKey));
}

export function paymentClient() {
  return new Payment(mercadoPagoClient());
}

export function verifyMercadoPagoSignature(args: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}) {
  if (!args.xSignature || !args.xRequestId || !args.dataId) {
    return false;
  }

  const parts = Object.fromEntries(
    args.xSignature.split(",").flatMap((part) => {
      const [key, value] = part.trim().split("=");
      return key && value ? [[key, value]] : [];
    }),
  );

  const timestamp = parts.ts;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return false;
  }

  const manifest = `id:${args.dataId};request-id:${args.xRequestId};ts:${timestamp};`;
  const expected = crypto
    .createHmac("sha256", env("MERCADO_PAGO_WEBHOOK_SECRET"))
    .update(manifest)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}
