import Link from "next/link";

import { OrganizerProfileForm } from "@/components/organizer-profile-form";
import { OrganizerShell } from "@/components/organizer-shell";
import { organizerStatusLabel } from "@/components/status-badges";
import { loadOrganizerByUserId } from "@/lib/auth-guards";
import { isOrganizerProfileComplete } from "@/lib/organizer-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Painel do parceiro</h1>
        <p className="mt-2 text-sm text-white/55">Entre para gerenciar eventos, QR Codes e reembolsos.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-semibold text-white" href="/login">
            Entrar
          </Link>
          <Link className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/75" href="/parceiros">
            Quero ser parceiro
          </Link>
        </div>
      </main>
    );
  }

  const organizer = await loadOrganizerByUserId(user.id);

  if (!organizer) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Torne-se parceiro</h1>
        <p className="mt-2 text-sm text-white/55">Você ainda não tem contrato. Candidate-se para anunciar sua balada.</p>
        <Link className="mt-6 inline-block rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-semibold text-white" href="/parceiros#candidatura">
          Quero ser parceiro
        </Link>
      </main>
    );
  }

  if (organizer.status !== "approved") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{organizer.trade_name}</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          Status: <strong className="font-semibold text-white">{organizerStatusLabel(organizer.status)}</strong>. O dashboard
          completo libera quando a TicketFly aprovar o contrato.
        </p>
        {organizer.status === "pending" ? (
          <div className="mt-8">
            <OrganizerProfileForm organizer={organizer} />
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <OrganizerShell tradeName={organizer.trade_name} profileIncomplete={!isOrganizerProfileComplete(organizer)}>
      {children}
    </OrganizerShell>
  );
}
