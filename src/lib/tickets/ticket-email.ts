import { formatDateTime } from "@/lib/format";
import { sendResendEmail } from "@/lib/email/resend";
import { publicTicketUrl } from "@/lib/qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapRelation } from "@/lib/ticket-access";
import { signTicketAccessToken } from "@/lib/ticket-crypto";
import { ticketAccessTtlSeconds } from "@/lib/tickets/access-window";
import { ensureStableGateCode } from "@/lib/tickets/gate-code";

type TicketMailRow = {
  id: string;
  code: string;
  status: string;
  buyer_name: string;
  buyer_email: string;
  events:
    | {
        title: string;
        starts_at: string;
        ends_at: string | null;
        venue_name: string;
        city: string | null;
      }
    | {
        title: string;
        starts_at: string;
        ends_at: string | null;
        venue_name: string;
        city: string | null;
      }[]
    | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildTicketEmail(args: {
  buyerName: string;
  eventTitle: string;
  when: string;
  venue: string;
  doorCode: string;
  ticketUrl: string;
}) {
  const subject = `Seu ingresso · ${args.eventTitle}`;
  const text = [
    `Olá, ${args.buyerName}.`,
    "",
    `Seu ingresso para ${args.eventTitle} está confirmado.`,
    args.when ? `Quando: ${args.when}` : "",
    args.venue ? `Onde: ${args.venue}` : "",
    "",
    `Código da porta: ${args.doorCode}`,
    "Mostre esse código ou o QR no link. Vale até o fim do evento e entra uma vez.",
    "",
    args.ticketUrl,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `<div style="font-family:sans-serif;background:#090008;color:#fff;padding:32px">
<p style="color:#ff1493;font-weight:800;letter-spacing:2px">TICKETFLY</p>
<p>Olá, ${escapeHtml(args.buyerName)}.</p>
<p>Seu ingresso para <strong>${escapeHtml(args.eventTitle)}</strong> está confirmado.</p>
${args.when ? `<p>${escapeHtml(args.when)}</p>` : ""}
${args.venue ? `<p>${escapeHtml(args.venue)}</p>` : ""}
<p style="margin-top:24px;color:#ffb1d5;font-size:12px;letter-spacing:1px">CÓDIGO DA PORTA</p>
<p style="font-size:32px;font-weight:900;letter-spacing:4px;margin:8px 0">${escapeHtml(args.doorCode)}</p>
<p>Mostre esse código ou o QR no link. Vale até o fim do evento e entra uma vez.</p>
<p style="margin-top:24px"><a href="${escapeHtml(args.ticketUrl)}" style="background:#ff1493;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Abrir ingresso</a></p>
</div>`;

  return { subject, text, html };
}

export async function deliverTicketEmail(ticketId: string, opts?: { idempotencyKey?: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tickets")
    .select("id,code,status,buyer_name,buyer_email,events(title,starts_at,ends_at,venue_name,city)")
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !data) return { ok: false as const, error: "Ingresso não encontrado" };

  const ticket = data as TicketMailRow;
  if (ticket.status !== "paid") return { ok: false as const, error: "Ingresso ainda não está pago" };

  const event = unwrapRelation(ticket.events);
  const gate = await ensureStableGateCode(ticket.id);
  const access = await signTicketAccessToken({
    code: ticket.code,
    buyerEmail: ticket.buyer_email,
    ttlSeconds: ticketAccessTtlSeconds(event),
  });
  const ticketUrl = publicTicketUrl(ticket.code, access);
  const when = event?.starts_at ? formatDateTime(event.starts_at) : "";
  const venue = [event?.venue_name, event?.city].filter(Boolean).join(" · ");
  const message = buildTicketEmail({
    buyerName: ticket.buyer_name,
    eventTitle: event?.title ?? "Evento",
    when,
    venue,
    doorCode: gate.code,
    ticketUrl,
  });

  return sendResendEmail({
    to: ticket.buyer_email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: opts?.idempotencyKey,
  });
}

export async function deliverTicketEmailForPayment(paymentId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tickets")
    .select("id,status")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (!data || data.status !== "paid") return { ok: false as const, error: "Ingresso pago não encontrado" };
  return deliverTicketEmail(data.id, { idempotencyKey: `ticket-email:${data.id}` });
}

/** Payment webhooks must stay 200 even if Resend fails. */
export async function emailPaidTicket(paymentId: string, source: string) {
  try {
    const sent = await deliverTicketEmailForPayment(paymentId);
    if (!sent.ok) console.error(`[ticket-email] ${source}`, sent.error);
  } catch (cause) {
    console.error(`[ticket-email] ${source}`, cause);
  }
}
