import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { after } from "next/server";

import {
  ORGANIZER_WEBHOOK_EVENTS,
  type OrganizerWebhookEvent,
} from "@/lib/organizer-webhook-events";
import { createAdminClient } from "@/lib/supabase/admin";

export { ORGANIZER_WEBHOOK_EVENTS, type OrganizerWebhookEvent };
type WebhookEnvelope = {
  id: string;
  type: OrganizerWebhookEvent;
  created_at: string;
  data: Record<string, unknown>;
};

const MAX_ATTEMPTS = 5;
const DELIVERY_TIMEOUT_MS = 8_000;

function isAllowedWebhookUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function generateWebhookSecret() {
  return randomBytes(32).toString("hex");
}

export function signWebhookPayload(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyWebhookSignature(args: {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
}) {
  const expected = signWebhookPayload(args.secret, args.timestamp, args.body);
  const a = Buffer.from(expected);
  const b = Buffer.from(args.signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function scheduleDeliveryFlush(deliveryIds: string[]) {
  if (deliveryIds.length === 0) return;
  after(async () => {
    for (const id of deliveryIds) {
      await attemptWebhookDelivery(id);
    }
  });
}

async function enqueueWebhook(args: {
  organizerId: string;
  eventType: OrganizerWebhookEvent;
  idempotencyKey: string;
  data: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,webhook_url,webhook_secret,webhook_enabled,webhook_events")
    .eq("id", args.organizerId)
    .maybeSingle();

  if (!organizer?.webhook_enabled || !organizer.webhook_url || !organizer.webhook_secret) {
    return null;
  }

  if (!isAllowedWebhookUrl(organizer.webhook_url)) {
    return null;
  }

  const subscribed = (organizer.webhook_events ?? []) as string[];
  if (!subscribed.includes(args.eventType)) {
    return null;
  }

  const envelope: WebhookEnvelope = {
    id: crypto.randomUUID(),
    type: args.eventType,
    created_at: new Date().toISOString(),
    data: args.data,
  };

  const { data: delivery, error } = await admin
    .from("webhook_deliveries")
    .upsert(
      {
        organizer_id: organizer.id,
        event_type: args.eventType,
        idempotency_key: args.idempotencyKey,
        payload: envelope,
        target_url: organizer.webhook_url,
        status: "pending",
        next_attempt_at: new Date().toISOString(),
      },
      {
        onConflict: "organizer_id,event_type,idempotency_key",
        ignoreDuplicates: true,
      },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[organizer-webhooks] enqueue failed", error.message);
    return null;
  }

  // ignoreDuplicates returns null row when already enqueued
  if (!delivery?.id) {
    const { data: existing } = await admin
      .from("webhook_deliveries")
      .select("id,status")
      .eq("organizer_id", organizer.id)
      .eq("event_type", args.eventType)
      .eq("idempotency_key", args.idempotencyKey)
      .maybeSingle();

    if (existing?.status === "pending") {
      scheduleDeliveryFlush([existing.id]);
      return existing.id;
    }
    return existing?.id ?? null;
  }

  scheduleDeliveryFlush([delivery.id]);
  return delivery.id;
}

export async function attemptWebhookDelivery(deliveryId: string) {
  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("webhook_deliveries")
    .select("id,organizer_id,payload,target_url,status,attempts")
    .eq("id", deliveryId)
    .maybeSingle();

  if (!delivery || delivery.status === "delivered") {
    return { ok: delivery?.status === "delivered" };
  }

  if (delivery.attempts >= MAX_ATTEMPTS) {
    await admin
      .from("webhook_deliveries")
      .update({
        status: "failed",
        last_error: "max_attempts_exceeded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return { ok: false };
  }

  const { data: organizer } = await admin
    .from("organizers")
    .select("webhook_secret,webhook_enabled,webhook_url")
    .eq("id", delivery.organizer_id)
    .maybeSingle();

  if (!organizer?.webhook_enabled || !organizer.webhook_secret || !organizer.webhook_url) {
    await admin
      .from("webhook_deliveries")
      .update({
        status: "failed",
        last_error: "webhook_disabled_or_misconfigured",
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    return { ok: false };
  }

  const body = JSON.stringify(delivery.payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signWebhookPayload(organizer.webhook_secret, timestamp, body);
  const eventType =
    typeof delivery.payload === "object" &&
    delivery.payload &&
    "type" in delivery.payload &&
    typeof (delivery.payload as { type?: unknown }).type === "string"
      ? (delivery.payload as { type: string }).type
      : "unknown";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const response = await fetch(delivery.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TicketFly-Webhooks/1.0",
        "X-TicketFly-Event": eventType,
        "X-TicketFly-Delivery": delivery.id,
        "X-TicketFly-Timestamp": timestamp,
        "X-TicketFly-Signature": signature,
      },
      body,
      signal: controller.signal,
    });

    const attempts = delivery.attempts + 1;
    if (response.ok) {
      await admin
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          attempts,
          response_status: response.status,
          last_error: null,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id);
      return { ok: true };
    }

    const backoffSeconds = Math.min(60 * 2 ** attempts, 3600);
    const nextAttempt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
    const failed = attempts >= MAX_ATTEMPTS;

    await admin
      .from("webhook_deliveries")
      .update({
        status: failed ? "failed" : "pending",
        attempts,
        response_status: response.status,
        last_error: `http_${response.status}`,
        next_attempt_at: nextAttempt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    return { ok: false };
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const backoffSeconds = Math.min(60 * 2 ** attempts, 3600);
    const failed = attempts >= MAX_ATTEMPTS;
    const message = error instanceof Error ? error.message : "delivery_error";

    await admin
      .from("webhook_deliveries")
      .update({
        status: failed ? "failed" : "pending",
        attempts,
        last_error: message.slice(0, 500),
        next_attempt_at: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function notifySaleCompleted(paymentId: string) {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select(
      "id,status,amount_cents,platform_fee_cents,net_amount_cents,partner_fee_share_cents,insurance_cents,event_id,ticket_batch_id,provider_payment_id,created_at",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment || payment.status !== "approved") return;

  const { data: event } = await admin
    .from("events")
    .select("id,title,slug,venue_name,city,starts_at,organizer_id")
    .eq("id", payment.event_id)
    .maybeSingle();

  if (!event) return;

  const { data: ticket } = await admin
    .from("tickets")
    .select("id,code,status,buyer_name,buyer_email,amount_paid_cents")
    .eq("payment_id", payment.id)
    .maybeSingle();

  const { data: batch } = await admin
    .from("ticket_batches")
    .select("id,name,price_cents")
    .eq("id", payment.ticket_batch_id)
    .maybeSingle();

  await enqueueWebhook({
    organizerId: event.organizer_id,
    eventType: "sale.completed",
    idempotencyKey: `sale.completed:${payment.id}`,
    data: {
      payment: {
        id: payment.id,
        status: payment.status,
        amount_cents: payment.amount_cents,
        platform_fee_cents: payment.platform_fee_cents,
        net_amount_cents: payment.net_amount_cents,
        partner_fee_share_cents: payment.partner_fee_share_cents,
        insurance_cents: payment.insurance_cents,
        provider_payment_id: payment.provider_payment_id,
        created_at: payment.created_at,
      },
      ticket: ticket
        ? {
            id: ticket.id,
            code: ticket.code,
            status: ticket.status,
            buyer_name: ticket.buyer_name,
            buyer_email: ticket.buyer_email,
            amount_paid_cents: ticket.amount_paid_cents,
          }
        : null,
      batch: batch
        ? {
            id: batch.id,
            name: batch.name,
            price_cents: batch.price_cents,
          }
        : null,
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        venue_name: event.venue_name,
        city: event.city,
        starts_at: event.starts_at,
      },
    },
  });
}

export async function notifySaleRefunded(args: {
  paymentId: string | null;
  ticketId: string;
}) {
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id,code,status,buyer_name,buyer_email,event_id,payment_id,amount_paid_cents")
    .eq("id", args.ticketId)
    .maybeSingle();

  if (!ticket) return;

  const { data: event } = await admin
    .from("events")
    .select("id,title,slug,venue_name,city,starts_at,organizer_id")
    .eq("id", ticket.event_id)
    .maybeSingle();

  if (!event) return;

  let payment = null as null | {
    id: string;
    status: string;
    amount_cents: number;
    net_amount_cents: number;
    provider_payment_id: string | null;
  };

  const paymentId = args.paymentId ?? ticket.payment_id;
  if (paymentId) {
    const { data } = await admin
      .from("payments")
      .select("id,status,amount_cents,net_amount_cents,provider_payment_id")
      .eq("id", paymentId)
      .maybeSingle();
    payment = data;
  }

  await enqueueWebhook({
    organizerId: event.organizer_id,
    eventType: "sale.refunded",
    idempotencyKey: `sale.refunded:${ticket.id}`,
    data: {
      ticket: {
        id: ticket.id,
        code: ticket.code,
        status: ticket.status,
        buyer_name: ticket.buyer_name,
        buyer_email: ticket.buyer_email,
        amount_paid_cents: ticket.amount_paid_cents,
      },
      payment,
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        venue_name: event.venue_name,
        city: event.city,
        starts_at: event.starts_at,
      },
    },
  });
}

export async function notifyEventWebhook(
  eventId: string,
  eventType: Extract<
    OrganizerWebhookEvent,
    "event.created" | "event.updated" | "event.published" | "event.cancelled"
  >,
) {
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select(
      "id,title,slug,description,venue_name,address,city,starts_at,ends_at,cover_image_url,status,organizer_id,created_at,updated_at",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return;

  await enqueueWebhook({
    organizerId: event.organizer_id,
    eventType,
    idempotencyKey: `${eventType}:${event.id}:${event.updated_at ?? event.created_at}`,
    data: {
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        description: event.description,
        venue_name: event.venue_name,
        address: event.address,
        city: event.city,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        cover_image_url: event.cover_image_url,
        status: event.status,
        created_at: event.created_at,
        updated_at: event.updated_at,
      },
    },
  });
}

export async function sendTestWebhook(organizerId: string) {
  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,trade_name,webhook_url,webhook_secret,webhook_enabled")
    .eq("id", organizerId)
    .maybeSingle();

  if (!organizer?.webhook_url || !organizer.webhook_secret) {
    return { ok: false as const, error: "Configure URL e secret do webhook primeiro" };
  }

  if (!isAllowedWebhookUrl(organizer.webhook_url)) {
    return { ok: false as const, error: "URL do webhook inválida (use HTTPS ou localhost)" };
  }

  const envelope: WebhookEnvelope = {
    id: crypto.randomUUID(),
    type: "sale.completed",
    created_at: new Date().toISOString(),
    data: {
      test: true,
      organizer: {
        id: organizer.id,
        trade_name: organizer.trade_name,
      },
      message: "Ping de teste TicketFly",
    },
  };

  const { data: delivery, error } = await admin
    .from("webhook_deliveries")
    .insert({
      organizer_id: organizer.id,
      event_type: "sale.completed",
      idempotency_key: `test:${crypto.randomUUID()}`,
      payload: envelope,
      target_url: organizer.webhook_url,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !delivery) {
    return { ok: false as const, error: "Não foi possível enfileirar o teste" };
  }

  const result = await attemptWebhookDelivery(delivery.id);
  return result.ok
    ? { ok: true as const, deliveryId: delivery.id }
    : { ok: false as const, error: "Endpoint não respondeu 2xx", deliveryId: delivery.id };
}

export { isAllowedWebhookUrl };
