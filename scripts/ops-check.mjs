import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CANONICAL_APP_HOST = "www.ticketfly.app";
const CANONICAL_SUPABASE_REF = "cbgcukhyytifirlvoygr";
const FORBIDDEN_SUPABASE_REF = "kxtpcsxwwdqsffenkcjn";
const FORBIDDEN_APP_HOSTS = new Set([
  "ticketfly.vercel.app",
  "ticket-fly.vercel.app",
  "ticketfly.app",
]);

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
  "CRON_SECRET",
];

const payment = [
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "ASAAS_API_KEY",
  "ASAAS_API_URL",
  "ASAAS_WEBHOOK_TOKEN",
];

const optional = ["MERCADO_PAGO_CLIENT_ID", "MERCADO_PAGO_CLIENT_SECRET"];

function present(key) {
  const value = env[key]?.trim() ?? "";
  if (!value) return false;
  if (value.includes("your-") || value.startsWith("replace-with")) return false;
  return true;
}

function hostOf(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function supabaseRef(url) {
  const host = hostOf(url);
  const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
  return match?.[1] ?? "";
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
const cronOk = (env.CRON_SECRET ?? "").trim().length >= 32;

const appHost = hostOf(env.NEXT_PUBLIC_APP_URL ?? "");
const projectRef = supabaseRef(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const asaasHost = hostOf(env.ASAAS_API_URL ?? "");
const cronUrl = `https://${CANONICAL_APP_HOST}/api/cron/expire-reservations`;

console.log("\nAlinhamento (produção yDeddz)");
console.log(`  App host: ${appHost || "(vazio)"}`);
console.log(`  Esperado: ${CANONICAL_APP_HOST}`);
console.log(`  Supabase ref: ${projectRef || "(vazio)"}`);
console.log(`  Esperado: ${CANONICAL_SUPABASE_REF}`);
console.log(`  Asaas API: ${asaasHost || "(vazio)"}`);
console.log(`  Cron HTTP: ${cronUrl}`);
console.log("  Mapa: docs/AMBIENTE.md");

let alignmentFailed = false;

if (projectRef === FORBIDDEN_SUPABASE_REF) {
  console.log("  [FALHA] Este é o projeto DIRETORIA DOS MLK — não é o TicketFly.");
  alignmentFailed = true;
}

if (FORBIDDEN_APP_HOSTS.has(appHost)) {
  console.log(`  [FALHA] Host ${appHost} não é o público. Use https://www.ticketfly.app`);
  alignmentFailed = true;
}

if (projectRef && projectRef !== CANONICAL_SUPABASE_REF) {
  console.log("  [FALHA] Supabase não é o projeto do yDeddz (cbgcukhyytifirlvoygr).");
  alignmentFailed = true;
}

if (appHost && appHost !== CANONICAL_APP_HOST && appHost !== "localhost:3000") {
  console.log("  [FALHA] NEXT_PUBLIC_APP_URL fora do domínio canônico.");
  alignmentFailed = true;
}

if (present("ASAAS_API_URL") && env.ASAAS_API_URL.includes("sandbox")) {
  console.log("  Asaas em SANDBOX — use só para homologação isolada, nunca no ar.");
}

console.log("\nResumo operacional");
console.log(`  QR secret ≥32 chars: ${qrOk ? "ok" : "FALTA"}`);
console.log(`  CRON_SECRET ≥32 chars: ${cronOk ? "ok" : "FALTA"}`);
console.log(`  Mercado Pago pronto: ${mpReady ? "ok" : "não"}`);
console.log(`  Asaas pronto: ${asaasReady ? "ok" : "não"}`);
console.log(`  Vendas na porta (exige Asaas): ${asaasReady ? "ok" : "bloqueado"}`);

const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
console.log("\nPróximos passos");
console.log("  1. npm run dev  (este .env.local fala com o banco de produção)");
console.log("  2. yDeddz: SQL Editor do projeto TicketFly — função expire_stale_reservations + porta");
console.log("  3. npm run ops:export-env → André cola na Vercel ticket-fly");
console.log(`  4. Conferir job externo → ${cronUrl}`);
console.log(`  5. Abrir ${appUrl.replace(/\/$/, "")}/eventos/ops-teste-agosto`);
console.log("  6. Comprar, confirmar webhook Asaas e escanear em /checkin");

if (missingRequired || !qrOk || !cronOk || (!mpReady && !asaasReady) || alignmentFailed) {
  console.log("\nAmbiente incompleto ou desalinhado. Ver docs/AMBIENTE.md.");
  process.exit(1);
}

console.log("\nAmbiente mínimo alinhado para homologação no stack do yDeddz.");
