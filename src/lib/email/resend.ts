const DEFAULT_FROM = "TicketFly <ingressos@ticketfly.app>";

export function resendFromAddress() {
  return process.env.RESEND_FROM?.trim() || DEFAULT_FROM;
}

export async function sendResendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false as const, error: "RESEND_API_KEY ausente" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(args.idempotencyKey ? { "Idempotency-Key": args.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: resendFromAddress(),
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok) {
    return { ok: false as const, error: body?.message ?? "Falha ao enviar e-mail" };
  }

  return { ok: true as const, id: body?.id ?? null };
}
