import { AdminStaffManager } from "@/components/admin-staff-manager";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("users")
    .select("id,email,full_name,role")
    .eq("role", "checkin")
    .order("email", { ascending: true });

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-black">Equipe de porta</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          Liberar /checkin para operadores. A pessoa precisa já ter conta na TicketFly. Organizadores aprovados não
          precisam disso.
        </p>
      </div>
      <AdminStaffManager staff={staff ?? []} />
    </div>
  );
}
