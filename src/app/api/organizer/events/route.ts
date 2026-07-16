import { NextResponse } from "next/server";

import { slugify } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { eventSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const input = eventSchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "Dados do evento inválidos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Login obrigatório" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,status")
    .eq("user_id", user.id)
    .single();

  if (!organizer || organizer.status !== "approved") {
    return NextResponse.json({ error: "Organizador não aprovado" }, { status: 403 });
  }

  const slug = `${slugify(input.data.title)}-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await admin
    .from("events")
    .insert({
      organizer_id: organizer.id,
      title: input.data.title,
      slug,
      description: input.data.description || null,
      venue_name: input.data.venueName,
      address: input.data.address,
      city: input.data.city,
      starts_at: input.data.startsAt,
      ends_at: input.data.endsAt || null,
      cover_image_url: input.data.coverImageUrl || null,
      status: "draft",
    })
    .select("id,slug")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao criar evento" }, { status: 500 });
  }

  return NextResponse.json(data);
}
