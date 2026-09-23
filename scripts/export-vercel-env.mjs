import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_APP_URL = "https://www.ticketfly.app";
const OUT_FILE = resolve(ROOT, ".env.vercel.import");

const KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TICKET_QR_SECRET",
  "CRON_SECRET",
  "PAGARME_SECRET_KEY",
  "PAGARME_ACCOUNT_ID",
  "PAGARME_PLATFORM_RECIPIENT_ID",
  "PAGARME_WEBHOOK_SECRET",
  "PAGARME_API_URL",
  "RESEND_API_KEY",
  "RESEND_FROM",
];

function loadEnvFile(fileName) {
  const filePath = resolve(ROOT, fileName);
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replaceAll("\\$", "$");
    out[key] = value;
  }
  return out;
}

function usable(value) {
  if (!value?.trim()) return false;
  if (value.includes("your-") || value.startsWith("replace-with")) return false;
  return true;
}

/** Bulk paste da Vercel: KEY=valor, sem aspas, sem #. $ no valor a UI recusa o lote inteiro. */
function envLine(key, value) {
  return `${key}=${value}`;
}

const env = {
  ...loadEnvFile(".env.example"),
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
};

const lines = [];
const included = [];
const skipped = [];
const byHand = [];

for (const key of KEYS) {
  const value = key === "NEXT_PUBLIC_APP_URL" ? CANONICAL_APP_URL : (env[key]?.trim() ?? "");
  if (!usable(value)) {
    skipped.push(key);
    continue;
  }
  if (value.includes("$")) {
    byHand.push({ key, value });
    continue;
  }
  lines.push(envLine(key, value));
  included.push(key);
}

writeFileSync(OUT_FILE, `${lines.join("\n")}\n`, "utf8");

console.log("TicketFly · export env para colar na Vercel");
console.log(`Paste (sem aspas, sem #, sem $): ${OUT_FILE}`);
console.log(`Incluidas (${included.length}): ${included.join(", ")}`);
if (byHand.length) {
  console.log(`Na mao (campo Value, comeca com $): ${byHand.map((item) => item.key).join(", ")}`);
}
if (skipped.length) {
  console.log(`Puladas: ${skipped.join(", ")}`);
}
console.log("\n1. Vercel → Environment Variables → apaga as chaves que ja existem (import nao sobrescreve).");
console.log("2. Cola o .env.vercel.import → Production → Save.");
console.log("3. Redeploy do deploy Ready.");
