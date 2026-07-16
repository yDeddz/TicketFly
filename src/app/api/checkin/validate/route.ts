import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkinSchema } from "@/lib/validators";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "checkin", "organizer"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissão para check-in" }, { status: 403 });
  }

  const admin = createAdminClient();

  if (profile.role === "organizer") {
    const { data: ticketByToken } = await admin
      .from("tickets")
      .select("event_id,events(organizers(user_id))")
      .eq("qr_token", input.data.qrToken)
      .maybeSingle();

    const { data: ticketByCode } =
      ticketByToken || !isUuid(input.data.qrToken)
        ? { data: null }
        : await admin
            .from("tickets")
            .select("event_id,events(organizers(user_id))")
            .eq("code", input.data.qrToken)
            .maybeSingle();

    const ticket = ticketByToken ?? ticketByCode;
    const event = Array.isArray(ticket?.events) ? ticket?.events[0] : ticket?.events;
    const organizer = Array.isArray(event?.organizers) ? event?.organizers[0] : event?.organizers;

    if (ticket && organizer?.user_id !== user.id) {
      return NextResponse.json({ error: "Sem permissão para este evento" }, { status: 403 });
    }
  }

  const { data, error } = await admin
    .rpc("perform_checkin", {
      p_qr_token: input.data.qrToken,
      p_operator_id: user.id,
      p_device_info: input.data.deviceInfo ?? null,
    })
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao validar ingresso" }, { status: 500 });
  }

  return NextResponse.json(data);
}
