import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = resolve(
  ROOT,
  "supabase/migrations/20260818190000_door_integrity_hardening.sql",
);

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

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = supabaseUrl?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];

if (!supabaseUrl || !serviceKey || !projectRef) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  process.exit(1);
}

const sql = readFileSync(MIGRATION, "utf8");
const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};

function rpcMissing(error) {
  const text = `${error?.message ?? ""} ${error?.code ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return text.includes("could not find the function") || text.includes("pgrst202") || text.includes("does not exist");
}

async function rest(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: response.status, json, text };
}

async function probe() {
  const openapi = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { ...headers, accept: "application/openapi+json" },
  });
  const spec = await openapi.json().catch(() => ({}));
  const paths = Object.keys(spec.paths ?? {});
  const rpcs = paths.filter((path) => path.startsWith("/rpc/")).map((path) => path.slice(5));
  const columns = await rest("/rest/v1/payments?select=id,sales_channel,idempotency_key,created_by&limit=1");
  return {
    ref: projectRef,
    hasCreateDoorSale: rpcs.includes("create_door_sale"),
    hasExpire: rpcs.includes("expire_stale_reservations"),
    hasCancelPending: rpcs.includes("cancel_pending_door_sale"),
    hasCancelTicket: rpcs.includes("cancel_ticket_restore_inventory"),
    hasApply: rpcs.includes("apply_payment_status"),
    paymentsOk: columns.status === 200,
    paymentsError: columns.status === 200 ? null : JSON.stringify(columns.json).slice(0, 200),
  };
}

async function applyViaPgMeta() {
  const endpoints = [
    `${supabaseUrl}/pg/query`,
    `${supabaseUrl}/pg-meta/default/query`,
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: sql }),
    });
    const text = await response.text();
    if (response.status < 500 && response.status !== 404) {
      return { endpoint, status: response.status, body: text.slice(0, 400) };
    }
  }
  return null;
}

async function verifyRpcs() {
  const dummy = "00000000-0000-0000-0000-000000000000";
  const checks = [];
  for (const [name, body] of [
    ["create_door_sale", {
      p_organizer_id: dummy,
      p_batch_id: dummy,
      p_buyer_name: "probe",
      p_buyer_email: "probe@ticketfly.app",
      p_buyer_phone: "11999999999",
      p_payment_method: "pix",
      p_created_by: dummy,
      p_idempotency_key: dummy,
    }],
    ["cancel_pending_door_sale", { p_payment_id: dummy, p_reason: "probe" }],
    ["cancel_ticket_restore_inventory", { p_ticket_id: dummy, p_actor_id: dummy, p_reason: "probe" }],
  ]) {
    const result = await rest(`/rest/v1/rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    checks.push({
      name,
      ok: result.status < 500 && !rpcMissing(result.json),
      status: result.status,
      missing: rpcMissing(result.json),
    });
  }
  return checks;
}

const before = await probe();
console.log("Banco:", before.ref);
console.log("Antes:", JSON.stringify({
  create_door_sale: before.hasCreateDoorSale,
  expire: before.hasExpire,
  apply: before.hasApply,
  cancel_pending: before.hasCancelPending,
  cancel_ticket: before.hasCancelTicket,
  payments: before.paymentsOk,
  paymentsError: before.paymentsError,
}));

if (!before.paymentsOk) {
  console.error("Sem acesso ao schema public.payments — abortando.");
  process.exit(1);
}

const applied = await applyViaPgMeta();
if (applied) {
  console.log("Apply:", applied.endpoint, applied.status, applied.body);
} else {
  console.log("Apply: nenhum endpoint de SQL aceitou o DDL (pg-meta/management API).");
}

const after = await probe();
const rpcs = await verifyRpcs();
console.log("Depois:", JSON.stringify({
  create_door_sale: after.hasCreateDoorSale,
  expire: after.hasExpire,
  apply: after.hasApply,
  cancel_pending: after.hasCancelPending,
  cancel_ticket: after.hasCancelTicket,
}));
console.log("RPC probe:", JSON.stringify(rpcs));

const ready = after.hasCreateDoorSale && after.hasExpire && after.hasCancelPending && after.hasCancelTicket;
process.exit(ready ? 0 : 2);
