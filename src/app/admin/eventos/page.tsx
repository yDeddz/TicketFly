import { AdminEventsManager } from "@/components/admin-events-manager";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("events")
    .select("id,title,description,venue_name,address,city,starts_at,ends_at,cover_image_url,status,organizers(trade_name)")
    .order("starts_at", { ascending: false });

  const adminEvents =
    events?.map((event) => ({
      ...event,
      organizers: Array.isArray(event.organizers) ? event.organizers[0] ?? null : event.organizers ?? null,
    })) ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-black">Eventos da plataforma</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">Edite dados públicos, datas e status de publicação.</p>
      </div>
      <AdminEventsManager events={adminEvents} />
    </div>
  );
}
