import { SignJWT, importPKCS8 } from "jose";

import { appUrl } from "@/lib/env";
import { signWalletBarcodePayload, WALLET_PASS_GRACE_SECONDS } from "@/lib/ticket-crypto";
import type { TicketAccessRow } from "@/lib/ticket-access";
import { unwrapRelation } from "@/lib/ticket-access";

export function googleWalletConfigured() {
  return Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
      process.env.GOOGLE_WALLET_SERVICE_EMAIL &&
      process.env.GOOGLE_WALLET_SERVICE_PRIVATE_KEY,
  );
}

function walletExpiresAt(ticket: TicketAccessRow) {
  const event = unwrapRelation(ticket.events);
  const end = event?.ends_at ? new Date(event.ends_at) : event?.starts_at ? new Date(event.starts_at) : new Date();
  const base = Number.isNaN(end.getTime()) ? new Date() : end;
  return new Date(base.getTime() + WALLET_PASS_GRACE_SECONDS * 1000);
}

export async function buildGoogleWalletSaveUrl(ticket: TicketAccessRow) {
  if (!googleWalletConfigured()) {
    return null;
  }

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const serviceEmail = process.env.GOOGLE_WALLET_SERVICE_EMAIL!;
  const privateKeyPem = process.env.GOOGLE_WALLET_SERVICE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const event = unwrapRelation(ticket.events);
  const batch = unwrapRelation(ticket.ticket_batches);
  const classId = `${issuerId}.pinkpass_event_generic`;
  const objectId = `${issuerId}.ticket_${ticket.id.replace(/-/g, "")}`;
  const barcodeValue = await signWalletBarcodePayload({
    ticketId: ticket.id,
    qrToken: ticket.qr_token,
    qrVersion: ticket.qr_version ?? 1,
    expiresAt: walletExpiresAt(ticket),
  });

  const genericObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    hexBackgroundColor: "#120410",
    logo: {
      sourceUri: {
        uri: `${appUrl()}/icon.png`,
      },
      contentDescription: {
        defaultValue: { language: "pt-BR", value: "PinkPass" },
      },
    },
    cardTitle: {
      defaultValue: { language: "pt-BR", value: "PinkPass" },
    },
    header: {
      defaultValue: { language: "pt-BR", value: event?.title ?? "Ingresso" },
    },
    subheader: {
      defaultValue: { language: "pt-BR", value: batch?.name ?? "Ingresso" },
    },
    textModulesData: [
      {
        id: "holder",
        header: "Participante",
        body: ticket.buyer_name,
      },
      {
        id: "venue",
        header: "Local",
        body: event ? `${event.venue_name}${event.city ? ` · ${event.city}` : ""}` : "—",
      },
    ],
    barcode: {
      type: "QR_CODE",
      value: barcodeValue,
      alternateText: ticket.code.slice(0, 8).toUpperCase(),
    },
    linksModuleData: {
      uris: [
        {
          uri: `${appUrl()}/ingressos/${ticket.code}`,
          description: "Abrir ingresso",
        },
      ],
    },
  };

  const claims = {
    iss: serviceEmail,
    aud: "google",
    typ: "savetowallet",
    origins: [appUrl()],
    payload: {
      genericObjects: [genericObject],
    },
  };

  const key = await importPKCS8(privateKeyPem, "RS256");
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .sign(key);

  return `https://pay.google.com/gp/v/save/${token}`;
}
