import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { organizerApplySchema } from "@/lib/validators";

export async function POST(request: Request) {
  const input = organizerApplySchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "Dados da balada inválidos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Faça login para se candidatar" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("organizers")
    .select("id,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Você já possui uma candidatura de parceiro" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("organizers")
    .insert({
      user_id: user.id,
      trade_name: input.data.tradeName,
      legal_name: input.data.legalName,
      document: input.data.document,
      phone: input.data.phone || null,
      city: input.data.city || null,
      partnership_notes: input.data.feeNote || null,
      status: "pending",
    })
    .select("id,status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao criar candidatura" }, { status: 500 });
  }

  await admin.from("users").update({ role: "organizer" }).eq("id", user.id).neq("role", "admin");

  return NextResponse.json({ ok: true, organizerId: data.id, status: data.status });
}
