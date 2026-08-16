import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.ticketfly.app";
const APEX = "https://ticketfly.app";
const ALIAS = "https://ticket-fly.vercel.app";
const FORBIDDEN = "https://ticketfly.vercel.app";

function loadEnvFile(fileName) {
  const filePath = resolve(ROOT, fileName);
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    out[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const env = { ...loadEnvFile(".env.local"), ...loadEnvFile(".env.vercel.import") };

function usable(value) {
  return Boolean(value?.trim()) && !value.includes("your-") && !value.startsWith("replace-with");
}

const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "OK   " : "FALHA"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchRes(url, init = {}) {
  const started = Date.now();
  const response = await fetch(url, { redirect: "manual", ...init });
  const text = await response.text();
  return { response, text, ms: Date.now() - started };
}

function locationHost(response) {
  const loc = response.headers.get("location") ?? "";
  try {
    return new URL(loc, BASE).host;
  } catch {
    return loc;
  }
}

async function main() {
  console.log(`TicketFly · validação de produção\nBase: ${BASE}\n`);

  const home = await fetchRes(`${BASE}/`);
  record(
    "GET / www",
    home.response.status === 200 && home.text.includes("TicketFly"),
    `HTTP ${home.response.status} ${home.ms}ms`,
  );
  record(
    "FAQ/copy no ar (Pix ou cartão)",
    home.text.includes("Pix") || home.text.includes("pix"),
    home.text.includes("checkout seguro do Mercado Pago") ? "ainda fala só Mercado Pago" : "copy atual",
  );

  const og = home.text.match(/property="og:url"\s+content="([^"]+)"/i)?.[1]
    ?? home.text.match(/content="([^"]+)"\s+property="og:url"/i)?.[1]
    ?? "";
  const canonical = home.text.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1]
    ?? home.text.match(/href="([^"]+)"\s+rel="canonical"/i)?.[1]
    ?? "";
  const metaHost = [og, canonical].find(Boolean) ?? "";
  if (metaHost) {
    record(
      "metadataBase / og:url usa www.ticketfly.app",
      metaHost.includes("www.ticketfly.app"),
      metaHost.slice(0, 80),
    );
  } else {
    record("metadataBase / og:url (opcional no HTML)", true, "Next não emitiu og:url nesta página");
  }
  record(
    "HTML não aponta para ticketfly.vercel.app (cópia Leonardo)",
    !home.text.includes("ticketfly.vercel.app"),
    "",
  );

  const ajuda = await fetchRes(`${BASE}/ajuda`);
  record(
    "GET /ajuda",
    ajuda.response.status === 200 && ajuda.text.includes("Pix ou cartão"),
    `HTTP ${ajuda.response.status}`,
  );

  const login = await fetchRes(`${BASE}/login`);
  record("GET /login", login.response.status === 200, `HTTP ${login.response.status}`);

  const eventos = await fetchRes(`${BASE}/eventos`);
  record("GET /eventos", eventos.response.status === 200, `HTTP ${eventos.response.status}`);

  const apex = await fetchRes(`${APEX}/`);
  const apexOk =
    apex.response.status === 200
    || (apex.response.status >= 300 && apex.response.status < 400 && locationHost(apex.response).includes("ticketfly.app"));
  record(
    "Apex ticketfly.app responde ou redireciona ao app",
    apexOk,
    `HTTP ${apex.response.status} loc=${apex.response.headers.get("location") ?? "(nenhum)"}`,
  );

  const alias = await fetchRes(`${ALIAS}/`);
  record(
    "Alias Vercel ticket-fly.vercel.app no ar (mesmo app)",
    alias.response.status === 200 || (alias.response.status >= 300 && alias.response.status < 400),
    `HTTP ${alias.response.status}`,
  );

  const forbidden = await fetchRes(`${FORBIDDEN}/`);
  record(
    "ticketfly.vercel.app NÃO deve ser o canônico (cópia Leonardo — só alerta)",
    true,
    `HTTP ${forbidden.response.status} — ignore este host`,
  );

  const cronNoAuth = await fetchRes(`${BASE}/api/cron/expire-reservations`);
  let cronBody = {};
  try {
    cronBody = JSON.parse(cronNoAuth.text);
  } catch {
    cronBody = {};
  }
  record(
    "Cron sem secret → 401",
    cronNoAuth.response.status === 401 && cronBody.code === "UNAUTHORIZED",
    `HTTP ${cronNoAuth.response.status} code=${cronBody.code ?? "(não-json)"}`,
  );

  if (usable(env.CRON_SECRET)) {
    const cronAuth = await fetchRes(`${BASE}/api/cron/expire-reservations`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    let cronAuthBody = {};
    try {
      cronAuthBody = JSON.parse(cronAuth.text);
    } catch {
      cronAuthBody = { raw: cronAuth.text.slice(0, 180) };
    }
    const cronOk = cronAuth.response.status === 200 && cronAuthBody.ok === true;
    record(
      "Cron com CRON_SECRET do .env.local → 200 + RPC",
      cronOk,
      cronOk
        ? `expired=${cronAuthBody.expired ?? 0}`
        : `HTTP ${cronAuth.response.status} code=${cronAuthBody.code ?? ""} msg=${cronAuthBody.message ?? cronAuthBody.error ?? ""}`.trim(),
    );
  } else {
    record("Cron com CRON_SECRET", false, "CRON_SECRET ausente no .env.local");
  }

  const hookNoAuth = await fetchRes(`${BASE}/api/webhooks/asaas`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  record(
    "Webhook Asaas sem token → 401",
    hookNoAuth.response.status === 401,
    `HTTP ${hookNoAuth.response.status}`,
  );

  if (usable(env.ASAAS_WEBHOOK_TOKEN)) {
    const hookAuth = await fetchRes(`${BASE}/api/webhooks/asaas`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "asaas-access-token": env.ASAAS_WEBHOOK_TOKEN,
      },
      body: "{}",
    });
    let hookBody = {};
    try {
      hookBody = JSON.parse(hookAuth.text);
    } catch {
      hookBody = {};
    }
    record(
      "Webhook Asaas com token do .env.local → received (token bate com a Vercel)",
      hookAuth.response.status === 200 && hookBody.received === true,
      `HTTP ${hookAuth.response.status} ${JSON.stringify(hookBody).slice(0, 80)}`,
    );
  } else {
    record("Webhook Asaas com token", false, "ASAAS_WEBHOOK_TOKEN ausente");
  }

  const mpHook = await fetchRes(`${BASE}/api/webhooks/mercado-pago`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  record(
    "Webhook MP sem assinatura → 401 (esperado; MP não está no env)",
    mpHook.response.status === 401,
    `HTTP ${mpHook.response.status}`,
  );

  const orgApi = await fetchRes(`${BASE}/api/organizer/events`);
  record(
    "API organizador sem sessão não vaza dados",
    orgApi.response.status === 401 || orgApi.response.status === 403 || orgApi.response.status === 405,
    `HTTP ${orgApi.response.status}`,
  );

  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} ok`);
  if (failed.length) {
    console.log("Falhas:");
    for (const item of failed) console.log(`  - ${item.name}: ${item.detail}`);
    process.exit(1);
  }
  console.log("Produção alinhada com o .env.local neste host.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
