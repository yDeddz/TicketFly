import { NextResponse } from "next/server";
import { z } from "zod";

import { asaasCreateSubaccount, hasAsaasConfig } from "@/lib/payments/asaas-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const connectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  cpfCnpj: z
    .string()
    .trim()
    .min(11)
    .max(18)
    .transform((v) => v.replace(/\D/g, "")),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).optional(),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
  mobilePhone: z.string().trim().min(8).max(20),
  address: z.string().trim().min(2).max(200),
  addressNumber: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(100).optional().or(z.literal("")),
  province: z.string().trim().min(2).max(100),
  postalCode: z
    .string()
    .trim()
    .min(8)
    .max(9)
    .transform((v) => v.replace(/\D/g, "")),
});

export async function POST(request: Request) {
  if (!hasAsaasConfig()) {
    return NextResponse.json({ error: "Asaas não configurado no servidor" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const parsed = connectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,status,asaas_connection_status,asaas_account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizer || organizer.status !== "approved") {
    return NextResponse.json({ error: "Organizador não aprovado" }, { status: 403 });
  }

  if (organizer.asaas_connection_status === "connected" && organizer.asaas_account_id) {
    return NextResponse.json(
      { error: "Conta Asaas já conectada. Use reconectar apenas se necessário via suporte." },
      { status: 409 },
    );
  }

  const input = parsed.data;
  const isCnpj = input.cpfCnpj.length > 11;

  try {
    await admin
      .from("organizers")
      .update({ asaas_connection_status: "pending" })
      .eq("id", organizer.id);

    const subaccount = await asaasCreateSubaccount({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      ...(input.birthDate ? { birthDate: input.birthDate } : {}),
      ...(isCnpj && input.companyType ? { companyType: input.companyType } : {}),
      ...(input.phone ? { phone: input.phone.replace(/\D/g, "") } : {}),
      mobilePhone: input.mobilePhone.replace(/\D/g, ""),
      address: input.address,
      addressNumber: input.addressNumber,
      ...(input.complement ? { complement: input.complement } : {}),
      province: input.province,
      postalCode: input.postalCode,
    });

    if (!subaccount.walletId || !subaccount.id) {
      throw new Error("Asaas subaccount response missing walletId/id");
    }

    await admin
      .from("organizers")
      .update({
        asaas_account_id: subaccount.id,
        asaas_wallet_id: subaccount.walletId,
        asaas_api_key: subaccount.apiKey ?? null,
        asaas_connection_status: "connected",
        primary_payment_provider: "asaas",
      })
      .eq("id", organizer.id);

    return NextResponse.json({
      ok: true,
      accountId: subaccount.id,
      walletId: subaccount.walletId,
      primary: "asaas",
    });
  } catch (error) {
    await admin
      .from("organizers")
      .update({ asaas_connection_status: "disconnected" })
      .eq("id", organizer.id);

    const message = error instanceof Error ? error.message : "Falha ao criar subconta Asaas";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
