import { assertAsaasProductionConfig, env, isProductionRuntime } from "@/lib/env";

export type AsaasCustomer = {
  id: string;
  name?: string;
  email?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
};

export type AsaasPayment = {
  id: string;
  status?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string | null;
  customer?: string;
  value?: number;
  billingType?: string;
  paymentDate?: string | null;
  deleted?: boolean;
};

export type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate: string;
  description?: string;
};

export type AsaasSubaccount = {
  id: string;
  walletId: string;
  apiKey?: string;
  name?: string;
  email?: string;
};

export type AsaasWebhookPayload = {
  event?: string;
  payment?: AsaasPayment;
};

function asaasBaseUrl() {
  if (isProductionRuntime()) {
    assertAsaasProductionConfig();
  }
  return (process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com").replace(/\/$/, "");
}

export function hasAsaasConfig() {
  return Boolean(process.env.ASAAS_API_KEY && !process.env.ASAAS_API_KEY.includes("your-"));
}

export function asaasApiKey() {
  return env("ASAAS_API_KEY");
}

export class AsaasRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AsaasRequestError";
  }
}

async function asaasFetch<T>(
  path: string,
  init?: RequestInit & { apiKey?: string },
): Promise<T> {
  assertAsaasProductionConfig();
  const apiKey = init?.apiKey ?? asaasApiKey();
  const { apiKey: _omit, ...rest } = init ?? {};
  void _omit;

  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    ...rest,
    signal: rest.signal ?? AbortSignal.timeout(12_000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      access_token: apiKey,
      ...(rest.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { errors?: Array<{ code?: string; description?: string }> }
      | null;
    const description = payload?.errors?.[0]?.description ?? "Falha no provedor de pagamento";
    throw new AsaasRequestError(response.status, description);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function asaasFindOrCreateCustomer(args: {
  name: string;
  email: string;
  cpfCnpj?: string;
  mobilePhone?: string;
}): Promise<AsaasCustomer> {
  const email = args.email.trim().toLowerCase();
  const cpfCnpj = args.cpfCnpj?.replace(/\D/g, "");
  const query = cpfCnpj
    ? `cpfCnpj=${encodeURIComponent(cpfCnpj)}`
    : `email=${encodeURIComponent(email)}`;
  const list = await asaasFetch<{ data?: AsaasCustomer[] }>(
    `/v3/customers?${query}&limit=1`,
  );

  const existing = list.data?.[0];
  if (existing?.id) {
    return asaasFetch<AsaasCustomer>(`/v3/customers/${encodeURIComponent(existing.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        name: args.name || "Comprador",
        email,
        ...(cpfCnpj ? { cpfCnpj } : {}),
        ...(args.mobilePhone ? { mobilePhone: args.mobilePhone } : {}),
        notificationDisabled: false,
      }),
    });
  }

  return asaasFetch<AsaasCustomer>("/v3/customers", {
    method: "POST",
    body: JSON.stringify({
      name: args.name || "Comprador",
      email,
      ...(cpfCnpj ? { cpfCnpj } : {}),
      ...(args.mobilePhone ? { mobilePhone: args.mobilePhone } : {}),
      notificationDisabled: false,
    }),
  });
}

export async function asaasCreatePayment(body: Record<string, unknown>): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/v3/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function asaasGetPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/v3/payments/${encodeURIComponent(paymentId)}`);
}

export async function asaasFindPaymentByExternalReference(reference: string) {
  const response = await asaasFetch<{ data?: AsaasPayment[] }>(
    `/v3/payments?externalReference=${encodeURIComponent(reference)}&limit=1`,
  );
  return response.data?.[0] ?? null;
}

export async function asaasGetPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(
    `/v3/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
  );
}

export async function asaasRefundPayment(paymentId: string): Promise<unknown> {
  return asaasFetch(`/v3/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function asaasCreateSubaccount(body: Record<string, unknown>): Promise<AsaasSubaccount> {
  return asaasFetch<AsaasSubaccount>("/v3/accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function verifyAsaasWebhookToken(headerToken: string | null) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return false;
  if (!headerToken) return false;
  return headerToken === expected;
}

export function mapAsaasPaymentStatus(status?: string): import("./types").LocalPaymentStatus {
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "approved";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "refunded";
    case "OVERDUE":
    case "DELETED":
      return "cancelled";
    default:
      return "pending";
  }
}

/** YYYY-MM-DD in America/Sao_Paulo-ish local date (server TZ may vary; +1 day is fine for checkout). */
export function asaasDueDate(daysAhead = 1) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}
