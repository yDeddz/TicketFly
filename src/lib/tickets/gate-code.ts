import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRelation } from "@/lib/ticket-access";
import {
  formatManualGateCode,
  generateManualGateCode,
  normalizeManualGateCode,
  WALLET_PASS_GRACE_SECONDS,
} from "@/lib/ticket-crypto";

import { eventAccessExpiresAt } from "@/lib/tickets/access-window";

type GateEvent = {
  starts_at: string;
  ends_at: string | null;
};

type GateRow = {
  manual_code: string | null;
  manual_code_expires_at: string | null;
  events: GateEvent | GateEvent[] | null;
};

export function gateCodeIsStable(args: {
  manualCode: string | null;
  manualCodeExpiresAt: string | null;
  targetExpiresAt: Date;
  now?: Date;
}) {
  if (!args.manualCode || !args.manualCodeExpiresAt) return false;
  const expiresAt = new Date(args.manualCodeExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;
  const now = (args.now ?? new Date()).getTime();
  if (expiresAt <= now) return false;
  return expiresAt >= args.targetExpiresAt.getTime() - 60_000;
}

function targetExpiry(row: GateRow) {
  return (
    eventAccessExpiresAt(unwrapRelation(row.events)) ??
    new Date(Date.now() + WALLET_PASS_GRACE_SECONDS * 1000)
  );
}

export async function ensureStableGateCode(ticketId: string) {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await admin
      .from("tickets")
      .select("manual_code,manual_code_expires_at,events(starts_at,ends_at)")
      .eq("id", ticketId)
      .maybeSingle();

    if (error || !data) {
      throw error ?? new Error("ticket_not_found");
    }

    const row = data as GateRow;
    const target = targetExpiry(row);

    if (
      gateCodeIsStable({
        manualCode: row.manual_code,
        manualCodeExpiresAt: row.manual_code_expires_at,
        targetExpiresAt: target,
      })
    ) {
      const raw = normalizeManualGateCode(row.manual_code!);
      return {
        raw,
        code: formatManualGateCode(raw),
        expiresAt: row.manual_code_expires_at!,
      };
    }

    const next = generateManualGateCode();
    const expiresAt = target.toISOString();
    let update = admin
      .from("tickets")
      .update({
        manual_code: next,
        manual_code_expires_at: expiresAt,
      })
      .eq("id", ticketId);

    update = row.manual_code ? update.eq("manual_code", row.manual_code) : update.is("manual_code", null);

    const { data: saved, error: saveError } = await update.select("manual_code").maybeSingle();

    if (saveError?.code === "23505") continue;
    if (saveError) throw saveError;
    if (saved?.manual_code) {
      return {
        raw: saved.manual_code,
        code: formatManualGateCode(saved.manual_code),
        expiresAt,
      };
    }
  }

  throw new Error("failed_to_allocate_manual_code");
}
