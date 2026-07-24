import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Login obrigatório" as const, status: 401 as const, user: null, profile: null };
  }

  const { data: profile } = await supabase.from("users").select("role,full_name,email").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    return { error: "Apenas administradores" as const, status: 403 as const, user, profile };
  }

  return { error: null, status: 200 as const, user, profile };
}

export async function requireApprovedOrganizer() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Login obrigatório" as const,
      status: 401 as const,
      user: null,
      organizer: null,
      isAdmin: false,
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  const { data: organizer } = await admin
    .from("organizers")
    .select("id,status,trade_name,legal_name,fee_threshold_cents,fee_percent_upto_threshold,fee_percent_above_threshold,partnership_notes,city,phone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (isAdmin && !organizer) {
    return { error: null, status: 200 as const, user, organizer: null, isAdmin: true };
  }

  if (!organizer) {
    return { error: "Organizador não encontrado" as const, status: 404 as const, user, organizer: null, isAdmin };
  }

  if (organizer.status !== "approved" && !isAdmin) {
    return { error: "Organizador não aprovado" as const, status: 403 as const, user, organizer, isAdmin };
  }

  return { error: null, status: 200 as const, user, organizer, isAdmin };
}
