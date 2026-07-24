import { OrganizerEventsManager } from "@/components/organizer-events-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrganizerEventsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: organizer } = await admin.from("organizers").select("id").eq("user_id", user.id).single();
  if (!organizer) return null;

  const { data: events } = await admin
    .from("events")
    .select("id,title,slug,status,starts_at,venue_name,ticket_batches(id,name,price_cents,quantity_total,quantity_sold,quantity_reserved)")
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false });

  return <OrganizerEventsManager events={events ?? []} />;
}
