import { TICKET_ACCESS_TTL_SECONDS, WALLET_PASS_GRACE_SECONDS } from "@/lib/ticket-crypto";

type EventWindow = {
  starts_at?: string | null;
  ends_at?: string | null;
} | null | undefined;

/** Same horizon as the wallet pass: event end (or start) plus 36h. */
export function eventAccessExpiresAt(event: EventWindow) {
  const raw = event?.ends_at || event?.starts_at;
  if (!raw) return null;
  const end = new Date(raw);
  if (Number.isNaN(end.getTime())) return null;
  return new Date(end.getTime() + WALLET_PASS_GRACE_SECONDS * 1000);
}

export function ticketAccessTtlSeconds(event: EventWindow, now = Date.now()) {
  const expiresAt = eventAccessExpiresAt(event);
  if (!expiresAt) return TICKET_ACCESS_TTL_SECONDS;
  return Math.max(60, Math.floor((expiresAt.getTime() - now) / 1000));
}
