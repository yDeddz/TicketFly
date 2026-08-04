import { NextResponse } from "next/server";

import { appUrl } from "@/lib/env";
import { exchangeMercadoPagoOAuthCode } from "@/lib/mercado-pago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const base = appUrl();

  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${base}/organizador/pagamentos?error=mp_oauth_denied`);
  }

  let organizerId: string | null = null;
  let uid: string | null = null;

  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      organizerId?: string;
      uid?: string;
    };
    organizerId = parsed.organizerId ?? null;
    uid = parsed.uid ?? null;
  } catch {
    return NextResponse.redirect(`${base}/organizador/pagamentos?error=mp_oauth_state`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== uid || !organizerId) {
    return NextResponse.redirect(`${base}/organizador/pagamentos?error=mp_oauth_session`);
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,user_id")
    .eq("id", organizerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizer) {
    return NextResponse.redirect(`${base}/organizador/pagamentos?error=mp_oauth_organizer`);
  }

  try {
    const token = await exchangeMercadoPagoOAuthCode(code);
    await admin
      .from("organizers")
      .update({
        mp_access_token: token.access_token,
        mp_collector_id: token.user_id != null ? String(token.user_id) : null,
        mp_connection_status: "connected",
        primary_payment_provider: "mercado_pago",
      })
      .eq("id", organizer.id);

    return NextResponse.redirect(`${base}/organizador/pagamentos?connected=1`);
  } catch {
    await admin
      .from("organizers")
      .update({ mp_connection_status: "disconnected" })
      .eq("id", organizer.id);
    return NextResponse.redirect(`${base}/organizador/pagamentos?error=mp_oauth_exchange`);
  }
}
