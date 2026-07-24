import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminOrganizerUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const input = adminOrganizerUpdateSchema.safeParse(await request.json());

  if (!input.success) {
    return NextResponse.json({ error: "Dados do organizador invalidos" }, { status: 400 });
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
    return NextResponse.json({ error: "Apenas administradores podem editar organizadores" }, { status: 403 });
  }

  const admin = createAdminClient();
  const updatePayload: Record<string, unknown> = {
    status: input.data.status,
    fee_threshold_cents: input.data.feeThresholdCents,
    fee_percent_upto_threshold: input.data.feePercentUptoThreshold,
    fee_percent_above_threshold: input.data.feePercentAboveThreshold,
    service_fee_platform_share_percent: input.data.serviceFeePlatformSharePercent,
  };

  if (input.data.status === "approved") {
    updatePayload.approved_by = user.id;
    updatePayload.approved_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("organizers")
    .update(updatePayload)
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao atualizar organizador" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
