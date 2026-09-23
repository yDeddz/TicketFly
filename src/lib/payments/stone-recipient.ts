import { digitsOnly } from "@/lib/organizer-profile";

export type StoneRecipient = {
  id: string;
  name: string | null;
  email: string | null;
  document: string | null;
  description: string | null;
  status: string | null;
};

export function matchRecipientByDocument(
  recipients: Array<Pick<StoneRecipient, "id" | "document">>,
  document: string | null | undefined,
) {
  const digits = digitsOnly(document);
  if (digits.length < 11) return null;
  return recipients.find((recipient) => digitsOnly(recipient.document) === digits) ?? null;
}

export function stoneRecipientLabel(recipient: Pick<StoneRecipient, "id" | "name" | "document">) {
  return [recipient.name, recipient.document, recipient.id].filter(Boolean).join(" · ");
}

export function recipientLinkBlock(args: {
  recipientId: string;
  platformRecipientId?: string | null;
  status?: string | null;
}) {
  if (args.platformRecipientId && args.recipientId === args.platformRecipientId) {
    return {
      code: "RECIPIENT_PLATFORM" as const,
      message: "Esse ID é o recebedor da TicketFly, não da casa.",
    };
  }
  if (args.status && args.status !== "active") {
    return { code: "RECIPIENT_INACTIVE" as const, message: "Recebedor Stone não está ativo" };
  }
  return null;
}
