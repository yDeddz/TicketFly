export function env(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function appUrl() {
  return env("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, "");
}

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/** Live QR / wallet signing secret — required in production (no service-role fallback). */
export function requireTicketQrSecret() {
  const dedicated = process.env.TICKET_QR_SECRET?.trim() ?? "";
  if (dedicated.length >= 32) return dedicated;

  if (isProductionRuntime()) {
    throw new Error("TICKET_QR_SECRET must be set (≥32 chars) in production");
  }

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (fallback.length >= 32) return fallback;

  throw new Error("TICKET_QR_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be at least 32 chars");
}

/** Reject sandbox Asaas URL when running in production. */
export function assertAsaasProductionConfig() {
  if (!isProductionRuntime()) return;

  const url = (process.env.ASAAS_API_URL ?? "").replace(/\/$/, "");
  if (!url || url.includes("sandbox")) {
    throw new Error("ASAAS_API_URL must be https://api.asaas.com in production (sandbox default blocked)");
  }

  if (!process.env.ASAAS_WEBHOOK_TOKEN?.trim()) {
    throw new Error("ASAAS_WEBHOOK_TOKEN is required in production");
  }
}

/** When true (default in production), reject raw 64-hex legacy QR tokens. */
export function allowLegacyHexQr() {
  if (process.env.ALLOW_LEGACY_HEX_QR === "true") return true;
  if (process.env.ALLOW_LEGACY_HEX_QR === "false") return false;
  return !isProductionRuntime();
}
