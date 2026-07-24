import { createHash } from "node:crypto";

import { appUrl } from "@/lib/env";
import { signWalletBarcodePayload, WALLET_PASS_GRACE_SECONDS } from "@/lib/ticket-crypto";
import type { TicketAccessRow } from "@/lib/ticket-access";
import { unwrapRelation } from "@/lib/ticket-access";

/**
 * Apple Wallet (.pkpass) requires Apple Developer Pass Type ID certificates.
 * When configured, this module prepares the pass.json model + barcode.
 * Full CMS signing of .pkpass is done only when all cert envs are present.
 */
export function appleWalletConfigured() {
  return Boolean(
    process.env.APPLE_PASS_TYPE_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_PASS_CERT_PEM &&
      process.env.APPLE_PASS_KEY_PEM &&
      process.env.APPLE_WWDR_CERT_PEM,
  );
}

function walletExpiresAt(ticket: TicketAccessRow) {
  const event = unwrapRelation(ticket.events);
  const end = event?.ends_at ? new Date(event.ends_at) : event?.starts_at ? new Date(event.starts_at) : new Date();
  const base = Number.isNaN(end.getTime()) ? new Date() : end;
  return new Date(base.getTime() + WALLET_PASS_GRACE_SECONDS * 1000);
}

export async function buildApplePassModel(ticket: TicketAccessRow) {
  const event = unwrapRelation(ticket.events);
  const batch = unwrapRelation(ticket.ticket_batches);
  const barcodeValue = await signWalletBarcodePayload({
    ticketId: ticket.id,
    qrToken: ticket.qr_token,
    qrVersion: ticket.qr_version ?? 1,
    expiresAt: walletExpiresAt(ticket),
  });

  const serial = createHash("sha256").update(ticket.id).digest("hex").slice(0, 32);

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID ?? "pass.br.com.pinkpass.ticket",
    serialNumber: serial,
    teamIdentifier: process.env.APPLE_TEAM_ID ?? "TEAMID",
    organizationName: "PinkPass",
    description: event?.title ?? "Ingresso PinkPass",
    logoText: "PinkPass",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(18, 4, 16)",
    labelColor: "rgb(255, 20, 147)",
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: barcodeValue,
        messageEncoding: "iso-8859-1",
        altText: ticket.code.slice(0, 8).toUpperCase(),
      },
    ],
    eventTicket: {
      primaryFields: [
        {
          key: "event",
          label: "EVENTO",
          value: event?.title ?? "Ingresso",
        },
      ],
      secondaryFields: [
        {
          key: "holder",
          label: "PARTICIPANTE",
          value: ticket.buyer_name,
        },
        {
          key: "batch",
          label: "LOTE",
          value: batch?.name ?? "—",
        },
      ],
      auxiliaryFields: [
        {
          key: "venue",
          label: "LOCAL",
          value: event?.venue_name ?? "—",
        },
        {
          key: "when",
          label: "DATA",
          value: event?.starts_at
            ? new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(event.starts_at))
            : "—",
        },
      ],
      backFields: [
        {
          key: "code",
          label: "Código do ingresso",
          value: ticket.code,
        },
        {
          key: "support",
          label: "Abrir ingresso online",
          value: `${appUrl()}/ingressos/${ticket.code}`,
          attributedValue: `<a href='${appUrl()}/ingressos/${ticket.code}'>Abrir ingresso</a>`,
        },
      ],
    },
    expirationDate: walletExpiresAt(ticket).toISOString(),
  };
}

/**
 * Build a signed .pkpass buffer when OpenSSL + certs are available.
 * Returns null when Apple Wallet is not configured (caller should offer QR download).
 */
export async function buildApplePkpassBuffer(ticket: TicketAccessRow): Promise<Buffer | null> {
  if (!appleWalletConfigured()) {
    return null;
  }

  // Dynamic import keeps local/dev builds working without optional native tooling.
  const { spawnSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash: hash } = await import("node:crypto");

  const pass = await buildApplePassModel(ticket);
  const dir = mkdtempSync(join(tmpdir(), "pinkpass-"));
  const passDir = join(dir, "pass");
  mkdirSync(passDir);

  try {
    writeFileSync(join(passDir, "pass.json"), JSON.stringify(pass));

    // Minimal 1x1 PNG placeholders — replace with branded assets in production.
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    writeFileSync(join(passDir, "icon.png"), tinyPng);
    writeFileSync(join(passDir, "paula.r@example.org"), tinyPng);
    writeFileSync(join(passDir, "logo.png"), tinyPng);
    writeFileSync(join(passDir, "paula.r@example.org"), tinyPng);

    const manifest: Record<string, string> = {};
    for (const file of ["pass.json", "icon.png", "paula.r@example.org", "logo.png", "paula.r@example.org"]) {
      const content = readFileSync(join(passDir, file));
      manifest[file] = hash("sha1").update(content).digest("hex");
    }
    writeFileSync(join(passDir, "manifest.json"), JSON.stringify(manifest));

    const certPath = join(dir, "signerCert.pem");
    const keyPath = join(dir, "signerKey.pem");
    const wwdrPath = join(dir, "wwdr.pem");
    writeFileSync(certPath, process.env.APPLE_PASS_CERT_PEM!.replace(/\\n/g, "\n"));
    writeFileSync(keyPath, process.env.APPLE_PASS_KEY_PEM!.replace(/\\n/g, "\n"));
    writeFileSync(wwdrPath, process.env.APPLE_WWDR_CERT_PEM!.replace(/\\n/g, "\n"));

    const sign = spawnSync(
      "openssl",
      [
        "smime",
        "-binary",
        "-sign",
        "-certfile",
        wwdrPath,
        "-signer",
        certPath,
        "-inkey",
        keyPath,
        "-in",
        join(passDir, "manifest.json"),
        "-out",
        join(passDir, "signature"),
        "-outform",
        "DER",
      ],
      { encoding: "utf8" },
    );

    if (sign.status !== 0) {
      throw new Error(sign.stderr || "Falha ao assinar Apple Pass");
    }

    const zip = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${passDir}\\*' -DestinationPath '${join(dir, "pass.zip")}' -Force`,
      ],
      { encoding: "utf8" },
    );

    if (zip.status !== 0) {
      // Fallback: try zip CLI
      const zipCli = spawnSync("zip", ["-r", "-X", join(dir, "pass.pkpass"), "."], {
        cwd: passDir,
        encoding: "utf8",
      });
      if (zipCli.status !== 0) {
        throw new Error("Não foi possível empacotar .pkpass (zip/openssl)");
      }
      return readFileSync(join(dir, "pass.pkpass"));
    }

    const zipBuf = readFileSync(join(dir, "pass.zip"));
    return zipBuf;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
