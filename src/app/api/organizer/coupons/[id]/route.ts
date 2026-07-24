import { NextResponse } from "next/server";

import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { couponUpdateSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

function emptyToNull(value: string | null | undefined) {
  if (value == null || value === "") return null;
  return value;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApprovedOrganizer();
  if (auth.error || !auth.organizer) {
    return NextResponse.json({ error: auth.error ?? "Sem permissão" }, { status: auth.status === 200 ? 403 : auth.status });
  }

  const { id } = await params;
  const input = couponUpdateSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.data.description !== undefined) patch.description = emptyToNull(input.data.description);
  if (input.data.discountType !== undefined) patch.discount_type = input.data.discountType;
  if (input.data.discountValue !== undefined) {
    patch.discount_value =
      (input.data.discountType ?? "percent") === "fixed"
        ? Math.round(input.data.discountValue)
        : input.data.discountValue;
  }
  if (input.data.eventId !== undefined) {
    const eventId = emptyToNull(input.data.eventId);
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
    patch.event_id = eventId;
  }
  if (input.data.promoterId !== undefined) {
    const promoterId = emptyToNull(input.data.promoterId);
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
    patch.promoter_id = promoterId;
  }
  if (input.data.maxUses !== undefined) {
    patch.max_uses =
      input.data.maxUses === "" || input.data.maxUses == null ? null : Number(input.data.maxUses);
  }
  if (input.data.startsAt !== undefined) patch.starts_at = emptyToNull(input.data.startsAt);
  if (input.data.endsAt !== undefined) patch.ends_at = emptyToNull(input.data.endsAt);
  if (input.data.isActive !== undefined) patch.is_active = input.data.isActive;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("coupons")
    .update(patch)
    .eq("id", id)
    .eq("organizer_id", auth.organizer.id)
    .select(
      "id,code,description,discount_type,discount_value,event_id,promoter_id,max_uses,uses_count,starts_at,ends_at,is_active,updated_at",
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Cupom não encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}
