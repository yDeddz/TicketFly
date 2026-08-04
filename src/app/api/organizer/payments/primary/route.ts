import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  provider: z.enum(["mercado_pago", "asaas"]),
});

/** Switch which connected provider is used at checkout (must already be connected). */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Provedor inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,mp_connection_status,asaas_connection_status,asaas_wallet_id,mp_access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizer) {
    return NextResponse.json({ error: "Organizador não encontrado" }, { status: 404 });
  }

  if (parsed.data.provider === "asaas") {
    if (organizer.asaas_connection_status !== "connected" || !organizer.asaas_wallet_id) {
      return NextResponse.json({ error: "Conecte o Asaas antes de ativá-lo" }, { status: 409 });
    }
  } else if (organizer.mp_connection_status !== "connected" || !organizer.mp_access_token) {
    return NextResponse.json({ error: "Conecte o Mercado Pago antes de ativá-lo" }, { status: 409 });
  }

  await admin
    .from("organizers")
    .update({ primary_payment_provider: parsed.data.provider })
    .eq("id", organizer.id);

  return NextResponse.json({ ok: true, primary: parsed.data.provider });
}
