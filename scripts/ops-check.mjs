import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const env = {
  ...loadEnvFile(".env.example"),
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TICKET_QR_SECRET",
];

const payment = [
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "ASAAS_API_KEY",
  "ASAAS_API_URL",
  "ASAAS_WEBHOOK_TOKEN",
];

const optional = ["CRON_SECRET", "MERCADO_PAGO_CLIENT_ID", "MERCADO_PAGO_CLIENT_SECRET"];

function present(key) {
  const value = env[key]?.trim() ?? "";
  if (!value) return false;
  if (value.includes("your-") || value.startsWith("replace-with")) return false;
  return true;
}

function report(label, keys, mode) {
  console.log(`\n${label}`);
  let missing = 0;
  for (const key of keys) {
    const ok = present(key);
    if (!ok) missing += 1;
    const mark = ok ? "ok" : mode === "required" ? "FALTA" : "—";
    console.log(`  [${mark}] ${key}`);
  }
  return missing;
}

console.log("TicketFly · checagem do ambiente de testes");
console.log(`Pasta: ${ROOT}`);
console.log(`.env.local: ${existsSync(resolve(ROOT, ".env.local")) ? "encontrado" : "AUSENTE — copie de .env.example"}`);

const missingRequired = report("Obrigatórias", required, "required");
const missingPayment = report("Pagamentos (pelo menos um provedor completo)", payment, "optional");
report("Opcionais", optional, "optional");

const mpReady = present("MERCADO_PAGO_ACCESS_TOKEN") && present("MERCADO_PAGO_WEBHOOK_SECRET");
const asaasReady = present("ASAAS_API_KEY") && present("ASAAS_WEBHOOK_TOKEN");
const qrOk = (env.TICKET_QR_SECRET ?? "").trim().length >= 32;

console.log("\nResumo operacional");
console.log(`  QR secret ≥32 chars: ${qrOk ? "ok" : "FALTA"}`);
console.log(`  Mercado Pago pronto: ${mpReady ? "ok" : "não"}`);
console.log(`  Asaas pronto: ${asaasReady ? "ok" : "não"}`);
console.log(`  Vendas na porta (exige Asaas): ${asaasReady ? "ok" : "bloqueado"}`);

if (present("ASAAS_API_URL") && env.ASAAS_API_URL.includes("sandbox")) {
  console.log("  Asaas em SANDBOX — use só para homologação, nunca em produção.");
}

const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
console.log("\nPróximos passos");
console.log("  1. npm run dev");
console.log("  2. No SQL Editor do Supabase: rode supabase/seed_test_ops.sql");
console.log(`  3. Abra ${appUrl.replace(/\/$/, "")}/eventos/ops-teste-agosto`);
console.log("  4. Compre um ingresso de teste, confirme webhook e escaneie em /checkin");

if (missingRequired || !qrOk || (!mpReady && !asaasReady)) {
  console.log("\nAmbiente incompleto. Preencha .env.local antes de vender.");
  process.exit(1);
}

if (!missingPayment && (mpReady || asaasReady)) {
  console.log("\nAmbiente mínimo pronto para homologação.");
}
