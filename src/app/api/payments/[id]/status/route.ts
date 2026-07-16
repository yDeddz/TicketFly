import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("payments")
    .select(
      "id,status,checkout_url,amount_cents,provider_payment_id,tickets(code,status,buyer_email)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}
