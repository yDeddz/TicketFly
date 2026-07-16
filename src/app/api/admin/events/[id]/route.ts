import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminEventUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const input = adminEventUpdateSchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "Dados do evento invalidos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Login obrigatorio" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Apenas administradores podem editar eventos" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .update({
      title: input.data.title,
      description: input.data.description || null,
      venue_name: input.data.venueName,
      address: input.data.address,
      city: input.data.city,
      starts_at: input.data.startsAt,
      ends_at: input.data.endsAt || null,
      cover_image_url: input.data.coverImageUrl || null,
      status: input.data.status,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao atualizar evento" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
