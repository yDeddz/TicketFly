import { OrganizerEventsManager } from "@/components/organizer-events-manager";
import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { isOrganizerProfileComplete, organizerReceivingReady } from "@/lib/organizer-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function OrganizerEventsPage() {
  const auth = await requireApprovedOrganizer();
  if (!auth.organizer) return null;

  const admin = createAdminClient();
  const { data: events } = await admin
    .from("events")
    .select(
      "id,title,slug,status,description,starts_at,ends_at,venue_name,address,city,cover_image_url,ticket_batches(id,name,price_cents,quantity_total,quantity_sold,quantity_reserved,is_active,sales_end_at)",
    )
    .eq("organizer_id", auth.organizer.id)
    .order("starts_at", { ascending: false });

  return (
    <OrganizerEventsManager
      events={events ?? []}
      paymentsReady={organizerReceivingReady(auth.organizer)}
      profileComplete={isOrganizerProfileComplete(auth.organizer)}
    />
  );
}
