import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckinScanner } from "@/components/checkin-scanner";
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

  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 pt-8">
      <CheckinScanner />
    </main>
  );
}
