import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fingerprintsMatch, resolveScanPayload } from "@/lib/ticket-crypto";
import { checkinSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const input = checkinSchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "QR Code inválido" }, { status: 400 });
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

  const resolved = await resolveScanPayload(input.data.qrToken);

  if (!resolved.ok) {
    const message =
      resolved.reason === "expired"
        ? "QR expirado — peça para atualizar a tela do ingresso"
        : "QR Code inválido ou não reconhecido";

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

  const admin = createAdminClient();

  let qrTokenForRpc: string | null = null;
  let ticketMeta: {
    id: string;
    event_id: string;
    qr_token: string;
    qr_version: number | null;
    events: unknown;
  } | null = null;

  if (resolved.mode === "legacy") {
    const { data } = await admin
      .from("tickets")
      .select("id,event_id,qr_token,qr_version,events(organizers(user_id))")
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
      .select("id,event_id,qr_token,qr_version,events(organizers(user_id))")
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

  if (profile.role === "organizer" && ticketMeta) {
    const eventsRaw = ticketMeta.events as
      | { organizers?: { user_id?: string } | { user_id?: string }[] }
      | { organizers?: { user_id?: string } | { user_id?: string }[] }[]
      | null;
    const event = Array.isArray(eventsRaw) ? eventsRaw[0] : eventsRaw;
    const organizersRaw = event?.organizers;
    const organizer = Array.isArray(organizersRaw) ? organizersRaw[0] : organizersRaw;

    if (organizer?.user_id && organizer.user_id !== user.id) {
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

  return NextResponse.json(data);
}
