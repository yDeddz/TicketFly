import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createContractSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const input = createContractSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Dados do contrato inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const email = input.data.email.toLowerCase();

  const { data: existingUser } = await admin.from("users").select("id,role").eq("email", email).maybeSingle();

  let userId = existingUser?.id;

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `${crypto.randomUUID().slice(0, 12)}Aa1!`,
      user_metadata: { full_name: input.data.tradeName },
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Não foi possível criar o usuário do parceiro" },
        { status: 400 },
      );
    }

    userId = created.user.id;
    await admin.from("users").upsert({
      id: userId,
      email,
      full_name: input.data.tradeName,
      role: "organizer",
    });
  } else {
    await admin
      .from("users")
      .update({ role: existingUser?.role === "admin" ? "admin" : "organizer" })
      .eq("id", userId);
  }

  const { data: existingOrganizer } = await admin.from("organizers").select("id").eq("user_id", userId).maybeSingle();
  if (existingOrganizer) {
    return NextResponse.json({ error: "Este e-mail já possui contrato de parceiro" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("organizers")
    .insert({
      user_id: userId,
      trade_name: input.data.tradeName,
      legal_name: input.data.legalName,
      document: input.data.document,
      phone: input.data.phone || null,
      city: input.data.city || null,
      partnership_notes: input.data.partnershipNotes || null,
      fee_threshold_cents: input.data.feeThresholdCents,
      fee_percent_upto_threshold: input.data.feePercentUptoThreshold,
      fee_percent_above_threshold: input.data.feePercentAboveThreshold,
      service_fee_platform_share_percent: input.data.serviceFeePlatformSharePercent,
      status: input.data.status,
      approved_by: input.data.status === "approved" ? auth.user.id : null,
      approved_at: input.data.status === "approved" ? new Date().toISOString() : null,
    })
    .select("id,trade_name,status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao criar contrato" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, organizer: data });
}
