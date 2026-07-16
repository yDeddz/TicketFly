import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Login obrigatório" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id,title,organizers(user_id,status)")
    .eq("id", eventId)
    .single();
  const organizer = Array.isArray(event?.organizers) ? event?.organizers[0] : event?.organizers;

  const isAllowed = organizer?.user_id === user.id && organizer.status === "approved";
  if (!isAllowed) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { data: tickets } = await admin
    .from("tickets")
    .select("buyer_name,buyer_email,status,amount_paid_cents,created_at,used_at,ticket_batches(name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const header = "nome,email,status,lote,valor_centavos,comprado_em,usado_em";
  const rows = (tickets ?? []).map((ticket) => {
    const batch = Array.isArray(ticket.ticket_batches) ? ticket.ticket_batches[0] : ticket.ticket_batches;
    return [
      ticket.buyer_name,
      ticket.buyer_email,
      ticket.status,
      batch?.name ?? "",
      ticket.amount_paid_cents,
      ticket.created_at,
      ticket.used_at ?? "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",");
  });

  return new Response([header, ...rows].join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="compradores-${eventId}.csv"`,
    },
  });
}
