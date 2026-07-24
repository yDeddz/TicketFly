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
    .select("id,status,ticket_batch_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !ticket) {
    return NextResponse.json({ error: "Ingresso não encontrado" }, { status: 404 });
  }

  if (!["pending", "paid"].includes(ticket.status)) {
    return NextResponse.json({ error: "Ingresso não pode ser cancelado neste status" }, { status: 409 });
  }

  const previousStatus = ticket.status;

  const { error } = await admin
    .from("tickets")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      manual_code: null,
      manual_code_expires_at: null,
    })
    .eq("id", id)
    .in("status", ["pending", "paid"]);

  if (error) {
    return NextResponse.json({ error: "Erro ao cancelar ingresso" }, { status: 500 });
  }

  // Invalidate live QR / wallet / manual gate codes (same as refund path).
  await admin.rpc("rotate_ticket_qr_token", { p_ticket_id: id });

  const { data: batch } = await admin
    .from("ticket_batches")
    .select("quantity_sold,quantity_reserved")
    .eq("id", ticket.ticket_batch_id)
    .single();

  if (batch) {
    if (previousStatus === "paid") {
      await admin
        .from("ticket_batches")
        .update({ quantity_sold: Math.max((batch.quantity_sold ?? 0) - 1, 0) })
        .eq("id", ticket.ticket_batch_id);
    } else if (previousStatus === "pending") {
      await admin
        .from("ticket_batches")
        .update({ quantity_reserved: Math.max((batch.quantity_reserved ?? 0) - 1, 0) })
        .eq("id", ticket.ticket_batch_id);
    }
  }

  return NextResponse.json({ ok: true });
}
