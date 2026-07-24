import { NextResponse } from "next/server";

import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoterSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const admin = createAdminClient();
  const { data: promoters, error } = await admin
    .from("promoters")
    .select("id,name,code,commission_percent,is_active,created_at,updated_at")
    .eq("organizer_id", auth.organizer.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao listar promotores" }, { status: 500 });
  }

  const ids = (promoters ?? []).map((p) => p.id);
  let salesByPromoter: Record<string, { sales: number; commission_cents: number }> = {};

  if (ids.length > 0) {
    const { data: sales } = await admin
      .from("promoter_sales")
      .select("promoter_id,commission_cents")
      .in("promoter_id", ids);

    for (const row of sales ?? []) {
      const current = salesByPromoter[row.promoter_id] ?? { sales: 0, commission_cents: 0 };
      current.sales += 1;
      current.commission_cents += row.commission_cents ?? 0;
      salesByPromoter[row.promoter_id] = current;
    }
  }

  return NextResponse.json({
    promoters: (promoters ?? []).map((p) => ({
      ...p,
      sales_count: salesByPromoter[p.id]?.sales ?? 0,
      commission_total_cents: salesByPromoter[p.id]?.commission_cents ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const input = promoterSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Dados inválidos", details: input.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const code = input.data.code.toUpperCase();

  const { data, error } = await admin
    .from("promoters")
    .insert({
      organizer_id: auth.organizer.id,
      name: input.data.name,
      code,
      commission_percent: input.data.commissionPercent,
      is_active: input.data.isActive ?? true,
    })
    .select("id,name,code,commission_percent,is_active,created_at")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Código de promotor já existe" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao criar promotor" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
