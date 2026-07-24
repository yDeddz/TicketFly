import { AdminContractsPanel } from "@/components/admin-contracts-panel";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminContractsPage() {
  const admin = createAdminClient();
  const { data: organizers } = await admin
    .from("organizers")
    .select(
      "id,trade_name,legal_name,document,phone,city,status,fee_threshold_cents,fee_percent_upto_threshold,fee_percent_above_threshold,service_fee_platform_share_percent,mp_connection_status,partnership_notes,created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <AdminContractsPanel
      organizers={(organizers ?? []).map((organizer) => ({
        ...organizer,
        fee_threshold_cents: organizer.fee_threshold_cents ?? 12000,
        fee_percent_upto_threshold: Number(organizer.fee_percent_upto_threshold ?? 12),
        fee_percent_above_threshold: Number(organizer.fee_percent_above_threshold ?? 9),
        service_fee_platform_share_percent: Number(organizer.service_fee_platform_share_percent ?? 50),
        mp_connection_status: organizer.mp_connection_status ?? "disconnected",
        partnership_notes: organizer.partnership_notes ?? null,
      }))}
    />
  );
}
