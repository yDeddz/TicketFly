import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { batchSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const input = batchSchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "Dados do lote inválidos" }, { status: 400 });
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
    .select("id,organizers(user_id,status)")
    .eq("id", input.data.eventId)
    .single();
  const organizer = Array.isArray(event?.organizers) ? event?.organizers[0] : event?.organizers;

  if (!event || organizer?.user_id !== user.id || organizer.status !== "approved") {
    return NextResponse.json({ error: "Sem permissão neste evento" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("ticket_batches")
    .insert({
      event_id: input.data.eventId,
      name: input.data.name,
      description: input.data.description || null,
      price_cents: input.data.priceCents,
      quantity_total: input.data.quantityTotal,
      sales_end_at: input.data.salesEndAt || null,
      switch_at: input.data.switchAt || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao criar lote" }, { status: 500 });
  }

  return NextResponse.json(data);
}
