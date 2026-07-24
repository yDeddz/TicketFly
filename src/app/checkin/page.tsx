import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckinScanner, type CheckinEventOption } from "@/components/checkin-scanner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/checkin")}`);
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();

  if (!profile || !["admin", "checkin", "organizer"].includes(profile.role)) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-10 pt-8">
        <section className="rounded-lg border border-[#ff3b6b]/40 bg-[#2a050d] p-6 text-[#ff9aae]">
          <h1 className="text-xl font-black">Sem permissão</h1>
          <p className="mt-2 text-sm">Sua conta não tem perfil de check-in, organizador ou admin.</p>
        </section>
      </main>
    );
  }

  const admin = createAdminClient();
  let events: CheckinEventOption[] = [];

  if (profile.role === "organizer") {
    const { data: organizer } = await admin
      .from("organizers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!organizer) {
      return (
        <main className="mx-auto max-w-lg px-4 pb-10 pt-8">
          <section className="rounded-lg border border-[#ff3b6b]/40 bg-[#2a050d] p-6 text-[#ff9aae]">
            <h1 className="text-xl font-black">Organizador não encontrado</h1>
            <p className="mt-2 text-sm">Sua conta ainda não está vinculada a um organizador.</p>
            <Link href="/organizador" className="mt-4 inline-flex text-sm font-bold underline">
              Voltar
            </Link>
          </section>
        </main>
      );
    }

    const { data } = await admin
      .from("events")
      .select("id,title,starts_at,status")
      .eq("organizer_id", organizer.id)
      .in("status", ["published", "draft"])
      .order("starts_at", { ascending: false })
      .limit(40);

    events = (data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      status: event.status,
    }));
  } else {
    const { data } = await admin
      .from("events")
      .select("id,title,starts_at,status")
      .in("status", ["published", "draft"])
      .order("starts_at", { ascending: false })
      .limit(60);

    events = (data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      status: event.status,
    }));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 pt-8">
      <CheckinScanner events={events} />
    </main>
  );
}
