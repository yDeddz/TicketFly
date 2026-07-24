import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fingerprintsMatch, resolveScanPayload } from "@/lib/ticket-crypto";
import { checkinSchema } from "@/lib/validators";

type TicketMeta = {
  id: string;
  event_id: string;
  qr_token: string;
  qr_version: number | null;
  buyer_name: string | null;
  events:
    | { id?: string; title?: string | null; organizer_id?: string | null }
    | { id?: string; title?: string | null; organizer_id?: string | null }[]
    | null;
};

function unwrapEvent(events: TicketMeta["events"]) {
  if (!events) return null;
  return Array.isArray(events) ? (events[0] ?? null) : events;
}

const TICKET_SELECT =
  "id,event_id,qr_token,qr_version,buyer_name,events(id,title,organizer_id)";

export async function POST(request: Request) {
  const input = checkinSchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "QR Code ou evento inválido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Login obrigatório" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (!profile || !["admin", "checkin", "organizer"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissão para check-in" }, { status: 403 });
  }

  const selectedEventId = input.data.eventId;
  const admin = createAdminClient();

  const { data: selectedEvent } = await admin
    .from("events")
    .select("id,title,organizer_id")
    .eq("id", selectedEventId)
    .maybeSingle();

  if (!selectedEvent) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  if (profile.role === "organizer") {
    const { data: organizer } = await admin
      .from("organizers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fail closed: missing organizer row or wrong owner → deny.
    if (!organizer?.id || organizer.id !== selectedEvent.organizer_id) {
      return NextResponse.json({ error: "Sem permissão para este evento" }, { status: 403 });
    }
  }

  const resolved = await resolveScanPayload(input.data.qrToken);

  if (!resolved.ok) {
    const message =
      resolved.reason === "expired"
        ? "QR expirado — peça para atualizar a tela do ingresso"
        : resolved.reason === "invalid" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              input.data.qrToken.trim(),
            )
          ? "Use o código curto da porta (ex.: AB12-CD34), não a referência pública"
          : "QR / código inválido ou não reconhecido";

    return NextResponse.json(
      {
        result: "not_found",
        message,
        ticket_id: null,
        event_id: null,
        reason: resolved.reason,
      },
      { status: 200 },
    );
  }

  let qrTokenForRpc: string | null = null;
  let ticketMeta: TicketMeta | null = null;

  if (resolved.mode === "manual") {
    const { data } = await admin
      .from("tickets")
      .select(`${TICKET_SELECT},manual_code_expires_at`)
      .eq("manual_code", resolved.manualCode)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({
        result: "not_found",
        message: "Código da porta inválido ou expirado — peça para atualizar o ingresso",
        ticket_id: null,
        event_id: null,
        reason: "invalid",
      });
    }

    const expiresAt = data.manual_code_expires_at
      ? new Date(data.manual_code_expires_at as string).getTime()
      : 0;

    if (!expiresAt || expiresAt < Date.now()) {
      return NextResponse.json({
        result: "not_found",
        message: "Código da porta expirado — peça para atualizar a tela do ingresso",
        ticket_id: data.id,
        event_id: data.event_id,
        reason: "expired",
      });
    }

    ticketMeta = data;
    qrTokenForRpc = data.qr_token;
  } else if (resolved.mode === "legacy") {
    const { data } = await admin
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("qr_token", resolved.qrToken)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({
        result: "not_found",
        message: "Ingresso não encontrado",
        ticket_id: null,
        event_id: null,
      });
    }

    ticketMeta = data;
    qrTokenForRpc = data.qr_token;
  } else {
    const { data } = await admin
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("id", resolved.ticketId)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({
        result: "not_found",
        message: "Ingresso não encontrado",
        ticket_id: null,
        event_id: null,
      });
    }

    if (!fingerprintsMatch(data.qr_token, resolved.fingerprint)) {
      return NextResponse.json({
        result: "cancelled",
        message: "QR invalidado — ingresso foi rotacionado ou cancelado",
        ticket_id: data.id,
        event_id: data.event_id,
      });
    }

    if (resolved.version > 0 && (data.qr_version ?? 1) !== resolved.version) {
      return NextResponse.json({
        result: "cancelled",
        message: "QR desatualizado — peça para atualizar a tela do ingresso",
        ticket_id: data.id,
        event_id: data.event_id,
      });
    }

    ticketMeta = data;
    qrTokenForRpc = data.qr_token;
  }

  if (!ticketMeta || ticketMeta.event_id !== selectedEventId) {
    return NextResponse.json({
      result: "not_found",
      message: "Ingresso de outro evento — confira o evento selecionado na porta",
      ticket_id: ticketMeta?.id ?? null,
      event_id: ticketMeta?.event_id ?? null,
      reason: "wrong_event",
    });
  }

  // Organizer: also fail closed against ticket's event owner (defense in depth).
  if (profile.role === "organizer") {
    const event = unwrapEvent(ticketMeta.events);
    const { data: organizer } = await admin
      .from("organizers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!organizer?.id || !event?.organizer_id || event.organizer_id !== organizer.id) {
      return NextResponse.json({ error: "Sem permissão para este evento" }, { status: 403 });
    }
  }

  const { data, error } = await admin
    .rpc("perform_checkin", {
      p_qr_token: qrTokenForRpc,
      p_operator_id: user.id,
      p_device_info: input.data.deviceInfo ?? null,
    })
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao validar ingresso" }, { status: 500 });
  }

  const event = unwrapEvent(ticketMeta.events);

  return NextResponse.json({
    ...data,
    buyer_name: ticketMeta.buyer_name ?? null,
    event_title: event?.title ?? selectedEvent.title ?? null,
    entry_mode: resolved.mode === "manual" ? "manual" : "scan",
  });
}
