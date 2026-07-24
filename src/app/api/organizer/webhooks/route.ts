import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedOrganizer } from "@/lib/auth-guards";
import {
  generateWebhookSecret,
  isAllowedWebhookUrl,
  sendTestWebhook,
} from "@/lib/organizer-webhooks";
import { ORGANIZER_WEBHOOK_EVENTS } from "@/lib/organizer-webhook-events";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  webhook_url: z.string().trim().url().nullable().optional(),
  webhook_enabled: z.boolean().optional(),
  webhook_events: z.array(z.enum(ORGANIZER_WEBHOOK_EVENTS)).min(1).optional(),
  rotate_secret: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.user || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("webhook_url,webhook_secret,webhook_enabled,webhook_events")
    .eq("id", auth.organizer.id)
    .single();

  const { data: deliveries } = await admin
    .from("webhook_deliveries")
    .select("id,event_type,status,attempts,response_status,last_error,delivered_at,created_at")
    .eq("organizer_id", auth.organizer.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    webhook_url: organizer?.webhook_url ?? null,
    webhook_secret: organizer?.webhook_secret ?? null,
    webhook_enabled: organizer?.webhook_enabled ?? false,
    webhook_events: organizer?.webhook_events ?? [...ORGANIZER_WEBHOOK_EVENTS],
    available_events: ORGANIZER_WEBHOOK_EVENTS,
    deliveries: deliveries ?? [],
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.user || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const input = patchSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (input.data.webhook_url && !isAllowedWebhookUrl(input.data.webhook_url)) {
    return NextResponse.json(
      { error: "URL inválida. Use HTTPS (ou http://localhost em desenvolvimento)." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("organizers")
    .select("webhook_secret")
    .eq("id", auth.organizer.id)
    .single();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.data.webhook_url !== undefined) {
    patch.webhook_url = input.data.webhook_url;
  }
  if (input.data.webhook_enabled !== undefined) {
    patch.webhook_enabled = input.data.webhook_enabled;
  }
  if (input.data.webhook_events) {
    patch.webhook_events = input.data.webhook_events;
  }

  let secret = current?.webhook_secret ?? null;
  if (input.data.rotate_secret || (!secret && (input.data.webhook_enabled || input.data.webhook_url))) {
    secret = generateWebhookSecret();
    patch.webhook_secret = secret;
  }

  if (input.data.webhook_enabled && !input.data.webhook_url && !current) {
    // no-op; validated below after merge
  }

  const { data: updated, error } = await admin
    .from("organizers")
    .update(patch)
    .eq("id", auth.organizer.id)
    .select("webhook_url,webhook_secret,webhook_enabled,webhook_events")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Erro ao salvar webhook" }, { status: 500 });
  }

  if (updated.webhook_enabled && !updated.webhook_url) {
    await admin.from("organizers").update({ webhook_enabled: false }).eq("id", auth.organizer.id);
    return NextResponse.json({ error: "Informe a URL do webhook antes de ativar" }, { status: 400 });
  }

  return NextResponse.json({
    webhook_url: updated.webhook_url,
    webhook_secret: updated.webhook_secret,
    webhook_enabled: updated.webhook_enabled,
    webhook_events: updated.webhook_events,
  });
}

export async function POST(request: Request) {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.user || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "test") {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const result = await sendTestWebhook(auth.organizer.id);
  if (!result.ok) {
    const status = "deliveryId" in result && result.deliveryId ? 502 : 400;
    return NextResponse.json({ error: result.error, deliveryId: "deliveryId" in result ? result.deliveryId : undefined }, { status });
  }

  return NextResponse.json({ ok: true, deliveryId: result.deliveryId });
}
