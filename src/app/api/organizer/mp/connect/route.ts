import { NextResponse } from "next/server";

import { appUrl } from "@/lib/env";
import { hasMercadoPagoOAuthConfig, mercadoPagoOAuthAuthorizeUrl } from "@/lib/mercado-pago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const base = appUrl();

  if (!hasMercadoPagoOAuthConfig()) {
    return NextResponse.redirect(new URL("/organizador/pagamentos?error=mp_oauth_not_configured", base));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", base));
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizer || organizer.status !== "approved") {
    return NextResponse.redirect(new URL("/organizador?error=not_approved", base));
  }

  await admin
    .from("organizers")
    .update({ mp_connection_status: "pending" })
    .eq("id", organizer.id);

  const state = Buffer.from(JSON.stringify({ organizerId: organizer.id, uid: user.id })).toString("base64url");
  return NextResponse.redirect(mercadoPagoOAuthAuthorizeUrl(state));
}
