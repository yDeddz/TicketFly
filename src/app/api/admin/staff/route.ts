import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminStaffSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id,email,full_name,role,created_at")
    .eq("role", "checkin")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Não foi possível listar a equipe" }, { status: 500 });
  }

  return NextResponse.json({ staff: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status });
  }

  const input = adminStaffSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id,email,role")
    .eq("email", input.data.email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { error: "Usuário não encontrado. Peça para a pessoa criar conta em /login com esse e-mail." },
      { status: 404 },
    );
  }

  if (profile.role === "admin") {
    return NextResponse.json({ error: "Não é possível alterar o papel de um admin por aqui" }, { status: 409 });
  }

  if (profile.role === "organizer") {
    return NextResponse.json(
      { error: "Organizadores já entram no check-in. Não troque o papel do parceiro." },
      { status: 409 },
    );
  }

  const { error } = await admin.from("users").update({ role: input.data.role }).eq("id", profile.id);
  if (error) {
    return NextResponse.json({ error: "Erro ao atualizar papel" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    email: profile.email,
    role: input.data.role,
  });
}
