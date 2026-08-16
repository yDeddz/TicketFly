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
  "ASAAS_API_KEY",
  "ASAAS_API_URL",
  "ASAAS_WEBHOOK_TOKEN",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
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
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }
  return out;
}

function usable(value) {
  if (!value?.trim()) return false;
  if (value.includes("your-") || value.startsWith("replace-with")) return false;
  return true;
}

function envLine(key, value) {
  // Aspas simples: a chave Asaas começa com $ e o import da Vercel
  // interpreta $VAR se o valor for sem aspas ou com aspas duplas.
  const escaped = value.replaceAll("'", "'\\''");
  return `${key}='${escaped}'`;
}

const env = {
  ...loadEnvFile(".env.example"),
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
};

const lines = [
  "# Importar na Vercel do André: projeto ticket-fly → Settings → Environment Variables",
  "# Production (+ Preview se for o mesmo banco). Depois Redeploy.",
  "# NÃO commitar este arquivo.",
  "",
];

const included = [];
const skipped = [];

for (const key of KEYS) {
  if (key === "NEXT_PUBLIC_APP_URL") {
    lines.push(envLine(key, CANONICAL_APP_URL));
    included.push(key);
    continue;
  }
  const value = env[key]?.trim() ?? "";
  if (!usable(value)) {
    skipped.push(key);
    continue;
  }
  lines.push(envLine(key, value));
  included.push(key);
}

writeFileSync(OUT_FILE, `${lines.join("\n")}\n`, "utf8");

console.log("TicketFly · export env para a Vercel do André");
console.log(`Arquivo: ${OUT_FILE}`);
console.log(`Incluídas (${included.length}): ${included.join(", ")}`);
if (skipped.length) {
  console.log(`Puladas (vazias/placeholder): ${skipped.join(", ")}`);
}
console.log("\nAndré: cole esse arquivo em");
console.log("https://vercel.com/ticket-fly/ticket-fly/settings/environment-variables");
console.log("Marque Production, salve, Redeploy. Não envie o arquivo no GitHub.");
