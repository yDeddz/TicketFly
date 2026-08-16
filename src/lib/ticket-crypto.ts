import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import { allowLegacyHexQr, requireTicketQrSecret } from "@/lib/env";

const QR_PREFIX = "PP1.";
const WALLET_PREFIX = "PPW1.";
const ACCESS_PREFIX = "PPA1.";
const DOOR_PAYMENT_PREFIX = "PPD1.";

/** Alphabet without 0/O/1/I — easy to dictate at the door. */
const MANUAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const MANUAL_CODE_LENGTH = 8;

/** Live gate QR lifetime (rotating on ticket screen). */
export const QR_SESSION_TTL_SECONDS = 90;
/** Wallet barcode grace after event end. */
export const WALLET_PASS_GRACE_SECONDS = 60 * 60 * 36;
/** Magic-link access to /ingressos/[code]. */
export const TICKET_ACCESS_TTL_SECONDS = 60 * 60 * 72;
/** Buyer link for a door payment; enough for PIX/card completion and ticket pickup. */
export const DOOR_PAYMENT_ACCESS_TTL_SECONDS = 60 * 60 * 48;

type QrClaims = {
  typ: "qr";
  tid: string;
  th: string;
  ver: number;
};

type WalletClaims = {
  typ: "wallet";
  tid: string;
  th: string;
  ver: number;
};

type AccessClaims = {
  typ: "access";
  code: string;
  email: string;
};

type DoorPaymentClaims = {
  typ: "door-payment";
  pid: string;
};

function signingKey() {
  return new TextEncoder().encode(requireTicketQrSecret());
}

export function tokenFingerprint(qrToken: string) {
  return createHash("sha256").update(qrToken).digest("hex").slice(0, 32);
}

export function fingerprintsMatch(qrToken: string, fingerprint: string) {
  return tokenFingerprint(qrToken) === fingerprint;
}

export async function signQrSessionPayload(args: {
  ticketId: string;
  qrToken: string;
  qrVersion: number;
  ttlSeconds?: number;
}) {
  const ttl = args.ttlSeconds ?? QR_SESSION_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    typ: "qr",
    tid: args.ticketId,
    th: tokenFingerprint(args.qrToken),
    ver: args.qrVersion,
  } satisfies QrClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("pinkpass")
    .setAudience("checkin")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(signingKey());

  return {
    payload: `${QR_PREFIX}${jwt}`,
    expiresAt: new Date((now + ttl) * 1000).toISOString(),
    expiresInSeconds: ttl,
  };
}

export async function signWalletBarcodePayload(args: {
  ticketId: string;
  qrToken: string;
  qrVersion: number;
  expiresAt: Date;
}) {
  const exp = Math.floor(args.expiresAt.getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    typ: "wallet",
    tid: args.ticketId,
    th: tokenFingerprint(args.qrToken),
    ver: args.qrVersion,
  } satisfies WalletClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("pinkpass")
    .setAudience("checkin")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(Math.max(exp, now + 60))
    .sign(signingKey());

  return `${WALLET_PREFIX}${jwt}`;
}

export async function signTicketAccessToken(args: {
  code: string;
  buyerEmail: string;
  ttlSeconds?: number;
}) {
  const ttl = args.ttlSeconds ?? TICKET_ACCESS_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    typ: "access",
    code: args.code,
    email: args.buyerEmail.toLowerCase(),
  } satisfies AccessClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("pinkpass")
    .setAudience("ticket-view")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(signingKey());

  return `${ACCESS_PREFIX}${jwt}`;
}

export async function verifyTicketAccessToken(token: string, expectedCode: string) {
  const raw = token.startsWith(ACCESS_PREFIX) ? token.slice(ACCESS_PREFIX.length) : token;

  try {
    const { payload } = await jwtVerify(raw, signingKey(), {
      issuer: "pinkpass",
      audience: "ticket-view",
    });

    if (payload.typ !== "access") return null;
    if (typeof payload.code !== "string" || payload.code !== expectedCode) return null;
    if (typeof payload.email !== "string") return null;

    return { code: payload.code, email: payload.email.toLowerCase() };
  } catch {
    return null;
  }
}

export async function signDoorPaymentAccessToken(args: {
  paymentId: string;
  ttlSeconds?: number;
}) {
  const ttl = args.ttlSeconds ?? DOOR_PAYMENT_ACCESS_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    typ: "door-payment",
    pid: args.paymentId,
  } satisfies DoorPaymentClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("pinkpass")
    .setAudience("door-payment")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(signingKey());

  return `${DOOR_PAYMENT_PREFIX}${jwt}`;
}

export async function verifyDoorPaymentAccessToken(token: string) {
  if (!token.startsWith(DOOR_PAYMENT_PREFIX)) return null;

  try {
    const { payload } = await jwtVerify(
      token.slice(DOOR_PAYMENT_PREFIX.length),
      signingKey(),
      {
        issuer: "pinkpass",
        audience: "door-payment",
      },
    );

    if (payload.typ !== "door-payment" || typeof payload.pid !== "string") return null;
    return { paymentId: payload.pid };
  } catch {
    return null;
  }
}

export type ResolvedScan =
  | {
      ok: true;
      mode: "signed";
      ticketId: string;
      fingerprint: string;
      version: number;
      kind: "session" | "wallet";
    }
  | { ok: true; mode: "legacy"; qrToken: string }
  | { ok: true; mode: "manual"; manualCode: string }
  | { ok: false; reason: "invalid" | "expired" | "malformed" };

/** Generate a short staff-dictation gate code (e.g. AB12CD34). */
export function generateManualGateCode(length = MANUAL_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += MANUAL_CODE_ALPHABET[bytes[i]! % MANUAL_CODE_ALPHABET.length];
  }
  return out;
}

/** Normalize typed gate code: strip separators, uppercase. */
export function normalizeManualGateCode(raw: string) {
  return raw.replace(/[\s\-_.]/g, "").toUpperCase();
}

export function formatManualGateCode(code: string) {
  const normalized = normalizeManualGateCode(code);
  if (normalized.length !== MANUAL_CODE_LENGTH) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function isManualGateCodeShape(raw: string) {
  const normalized = normalizeManualGateCode(raw);
  if (normalized.length !== MANUAL_CODE_LENGTH) return false;
  return [...normalized].every((ch) => MANUAL_CODE_ALPHABET.includes(ch));
}

/**
 * Resolve a scanned QR payload into ticket binding claims.
 * Never treats a bare UUID (public code) as a valid credential.
 */
export async function resolveScanPayload(rawInput: string): Promise<ResolvedScan> {
  const raw = rawInput.trim();

  if (!raw || raw.length < 8) {
    return { ok: false, reason: "malformed" };
  }

  // Reject bare UUID — public ticket code is not a check-in credential.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return { ok: false, reason: "invalid" };
  }

  // Short rotating gate code for staff typing when camera fails.
  if (isManualGateCodeShape(raw)) {
    return { ok: true, mode: "manual", manualCode: normalizeManualGateCode(raw) };
  }

  if (raw.startsWith(QR_PREFIX) || raw.startsWith(WALLET_PREFIX)) {
    const kind = raw.startsWith(QR_PREFIX) ? ("session" as const) : ("wallet" as const);
    const jwt = raw.slice(kind === "session" ? QR_PREFIX.length : WALLET_PREFIX.length);

    try {
      const { payload } = await jwtVerify(jwt, signingKey(), {
        issuer: "pinkpass",
        audience: "checkin",
      });

      const expectedTyp = kind === "session" ? "qr" : "wallet";
      if (payload.typ !== expectedTyp) return { ok: false, reason: "invalid" };
      if (typeof payload.tid !== "string" || typeof payload.th !== "string") {
        return { ok: false, reason: "malformed" };
      }

      return {
        ok: true,
        mode: "signed",
        ticketId: payload.tid,
        fingerprint: payload.th,
        version: typeof payload.ver === "number" ? payload.ver : 1,
        kind,
      };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : "";
      if (name === "JWTExpired" || message.toLowerCase().includes("expir")) {
        return { ok: false, reason: "expired" };
      }
      return { ok: false, reason: "invalid" };
    }
  }

  // Legacy emergency: raw 64-char hex qr_token (never a public UUID).
  // Disabled in production unless ALLOW_LEGACY_HEX_QR=true.
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    if (!allowLegacyHexQr()) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, mode: "legacy", qrToken: raw.toLowerCase() };
  }

  return { ok: false, reason: "invalid" };
}
