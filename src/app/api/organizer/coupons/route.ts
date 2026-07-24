import { NextResponse } from "next/server";

import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { couponSchema } from "@/lib/validators";

function emptyToNull(value: string | null | undefined) {
  if (value == null || value === "") return null;
  return value;
}

export async function GET() {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const admin = createAdminClient();

  const [{ data: coupons, error }, { data: events }, { data: promoters }] = await Promise.all([
    admin
      .from("coupons")
      .select(
        "id,code,description,discount_type,discount_value,event_id,promoter_id,max_uses,uses_count,starts_at,ends_at,is_active,created_at,updated_at",
      )
      .eq("organizer_id", auth.organizer.id)
      .order("created_at", { ascending: false }),
    admin.from("events").select("id,title,status").eq("organizer_id", auth.organizer.id).order("starts_at", { ascending: false }),
    admin
      .from("promoters")
      .select("id,name,code,is_active")
      .eq("organizer_id", auth.organizer.id)
      .order("name", { ascending: true }),
  ]);

  if (error) {
    return NextResponse.json({ error: "Erro ao listar cupons" }, { status: 500 });
  }

  return NextResponse.json({
    coupons: coupons ?? [],
    events: events ?? [],
    promoters: promoters ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const input = couponSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Dados inválidos", details: input.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const eventId = emptyToNull(input.data.eventId);
  const promoterId = emptyToNull(input.data.promoterId);

  if (eventId) {
    const { data: event } = await admin
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("organizer_id", auth.organizer.id)
      .maybeSingle();
    if (!event) {
      return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    }
  }

  if (promoterId) {
    const { data: promoter } = await admin
      .from("promoters")
      .select("id")
      .eq("id", promoterId)
      .eq("organizer_id", auth.organizer.id)
      .maybeSingle();
    if (!promoter) {
      return NextResponse.json({ error: "Promotor inválido" }, { status: 400 });
    }
  }

  const { data, error } = await admin
    .from("coupons")
    .insert({
      organizer_id: auth.organizer.id,
      code: input.data.code.toUpperCase(),
      description: emptyToNull(input.data.description),
      discount_type: input.data.discountType,
      discount_value:
        input.data.discountType === "fixed"
          ? Math.round(input.data.discountValue)
          : input.data.discountValue,
      event_id: eventId,
      promoter_id: promoterId,
      max_uses:
        input.data.maxUses === "" || input.data.maxUses == null
          ? null
          : Number(input.data.maxUses),
      starts_at: emptyToNull(input.data.startsAt),
      ends_at: emptyToNull(input.data.endsAt),
      is_active: input.data.isActive ?? true,
    })
    .select(
      "id,code,description,discount_type,discount_value,event_id,promoter_id,max_uses,uses_count,starts_at,ends_at,is_active,created_at",
    )
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Já existe um cupom com este código" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao criar cupom" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
