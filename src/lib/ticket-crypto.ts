import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const QR_PREFIX = "PP1.";
const WALLET_PREFIX = "PPW1.";
const ACCESS_PREFIX = "PPA1.";

/** Live gate QR lifetime (rotating on ticket screen). */
export const QR_SESSION_TTL_SECONDS = 90;
/** Wallet barcode grace after event end. */
export const WALLET_PASS_GRACE_SECONDS = 60 * 60 * 36;
/** Magic-link access to /ingressos/[code]. */
export const TICKET_ACCESS_TTL_SECONDS = 60 * 60 * 72;

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

function signingKey() {
  const secret =
    process.env.TICKET_QR_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";

  if (!secret || secret.length < 32) {
    throw new Error("TICKET_QR_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be at least 32 chars");
  }

  return new TextEncoder().encode(secret);
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
  | { ok: false; reason: "invalid" | "expired" | "malformed" };

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
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return { ok: true, mode: "legacy", qrToken: raw.toLowerCase() };
  }

  return { ok: false, reason: "invalid" };
}
