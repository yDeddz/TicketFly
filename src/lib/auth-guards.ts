import { apiError } from "@/lib/api-error";
import { ORGANIZER_PROFILE_SELECT } from "@/lib/organizer-profile";
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

const organizerSelect = ORGANIZER_PROFILE_SELECT;

export async function requireOrganizerAccount(options?: { allowPending?: boolean }) {
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
    .select(organizerSelect)
    .eq("user_id", user.id)
    .maybeSingle();

  if (isAdmin && !organizer) {
    return { error: null, status: 200 as const, user, organizer: null, isAdmin: true };
  }

  if (!organizer) {
    return { error: "Organizador não encontrado" as const, status: 404 as const, user, organizer: null, isAdmin };
  }

  if (organizer.status === "rejected" || organizer.status === "suspended") {
    return { error: "Organizador bloqueado" as const, status: 403 as const, user, organizer, isAdmin };
  }

  if (!options?.allowPending && organizer.status !== "approved" && !isAdmin) {
    return { error: "Organizador não aprovado" as const, status: 403 as const, user, organizer, isAdmin };
  }

  return { error: null, status: 200 as const, user, organizer, isAdmin };
}

export async function requireApprovedOrganizer() {
  return requireOrganizerAccount({ allowPending: false });
}

export function organizerAuthError(
  auth: Awaited<ReturnType<typeof requireOrganizerAccount>>,
  options?: { allowAdminWithoutOrganizer?: boolean },
) {
  if (auth.error || !auth.user) {
    return apiError(auth.status, {
      message: auth.error ?? "Sem permissão",
      code: "ORGANIZER_FORBIDDEN",
    });
  }
  if (!auth.organizer && !(options?.allowAdminWithoutOrganizer && auth.isAdmin)) {
    return apiError(403, { message: "Sem permissão", code: "ORGANIZER_FORBIDDEN" });
  }
  return null;
}
