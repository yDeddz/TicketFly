import crypto from "node:crypto";

import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

import { appUrl, env } from "@/lib/env";

export function mercadoPagoClient(accessToken?: string, idempotencyKey?: string) {
  return new MercadoPagoConfig({
    accessToken: accessToken || env("MERCADO_PAGO_ACCESS_TOKEN"),
    options: {
      timeout: 8000,
      idempotencyKey,
    },
  });
}

export function preferenceClient(idempotencyKey?: string, accessToken?: string) {
  return new Preference(mercadoPagoClient(accessToken, idempotencyKey));
}

export function paymentClient(accessToken?: string) {
  return new Payment(mercadoPagoClient(accessToken));
}

export function hasMercadoPagoOAuthConfig() {
  return Boolean(process.env.MERCADO_PAGO_CLIENT_ID && process.env.MERCADO_PAGO_CLIENT_SECRET);
}

export function mercadoPagoOAuthAuthorizeUrl(state: string) {
  const clientId = env("MERCADO_PAGO_CLIENT_ID");
  const redirectUri = `${appUrl()}/api/organizer/mp/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri,
    state,
  });
  return `https://auth.mercadopago.com.br/authorization?${params.toString()}`;
}

export async function exchangeMercadoPagoOAuthCode(code: string) {
  const redirectUri = `${appUrl()}/api/organizer/mp/callback`;
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env("MERCADO_PAGO_CLIENT_ID"),
      client_secret: env("MERCADO_PAGO_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MP OAuth token exchange failed: ${text}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    user_id?: number | string;
    public_key?: string;
    expires_in?: number;
  };
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
