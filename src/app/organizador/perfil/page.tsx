import { OrganizerProfileForm } from "@/components/organizer-profile-form";
import { ORGANIZER_PROFILE_SELECT, isOrganizerProfileComplete } from "@/lib/organizer-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrganizerProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select(ORGANIZER_PROFILE_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!organizer) return null;

  const complete = isOrganizerProfileComplete(organizer);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-black">Perfil da casa</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          {complete
            ? "Ficha completa — a TicketFly usa estes dados para cadastrar o recebedor na Stone."
            : "Falta documento, endereço ou telefone. Sem a ficha completa a TicketFly não cadastra o recebedor na Stone."}
        </p>
      </div>
      <OrganizerProfileForm organizer={organizer} />
    </div>
  );
}
