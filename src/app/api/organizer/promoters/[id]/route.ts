import { NextResponse } from "next/server";

import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoterUpdateSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const { id } = await params;
  const input = promoterUpdateSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (input.data.name !== undefined) patch.name = input.data.name;
  if (input.data.code !== undefined) patch.code = input.data.code.toUpperCase();
  if (input.data.commissionPercent !== undefined) patch.commission_percent = input.data.commissionPercent;
  if (input.data.isActive !== undefined) patch.is_active = input.data.isActive;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("promoters")
    .update(patch)
    .eq("id", id)
    .eq("organizer_id", auth.organizer.id)
    .select("id,name,code,commission_percent,is_active,updated_at")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Código de promotor já existe" }, { status: 409 });
    }
    return NextResponse.json({ error: "Promotor não encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}
