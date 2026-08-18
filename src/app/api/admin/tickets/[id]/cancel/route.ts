import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Login obrigatório" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: ticket, error: loadError } = await admin
    .from("tickets")
    .select("id,status,payment_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !ticket) {
    return NextResponse.json({ error: "Ingresso não encontrado" }, { status: 404 });
  }

  if (!["pending", "paid"].includes(ticket.status)) {
    return NextResponse.json({ error: "Ingresso não pode ser cancelado neste status" }, { status: 409 });
  }

  if (!ticket.payment_id) {
    if (ticket.status !== "pending") {
      return NextResponse.json({ error: "Ingresso pago sem pagamento vinculado" }, { status: 409 });
    }
    const { error } = await admin.rpc("release_reserved_ticket", { p_ticket_id: id });
    if (error) {
      return NextResponse.json({ error: "Erro ao cancelar ingresso" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin.rpc("apply_payment_status", {
    p_payment_id: ticket.payment_id,
    p_status: ticket.status === "pending" ? "cancelled" : "refunded",
    p_provider_payment_id: null,
    p_payload: {
      source: "admin_cancel",
      actor: user.id,
    },
  });

  if (error) {
    return NextResponse.json({ error: "Erro ao cancelar ingresso" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
