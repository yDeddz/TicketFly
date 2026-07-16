import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrganizerPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthMessage title="Painel do organizador" />;
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,status,trade_name")
    .eq("user_id", user.id)
    .single();

  if (!organizer) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-6 shadow-sm shadow-[#ff1493]/10">
          <h1 className="text-2xl font-black">Solicite aprovação como organizador</h1>
          <p className="mt-2 text-[#c9aabc]">
            Crie um registro em `organizers` ligado ao seu usuário. O admin aprova no banco ou pelo painel.
          </p>
        </div>
      </main>
    );
  }

  const { data: events } = await admin
    .from("events")
    .select("id,title,slug,status,starts_at,tickets(status,amount_paid_cents),checkins(id)")
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false });

  const paidTickets =
    events?.flatMap((event) => event.tickets ?? []).filter((ticket) => ticket.status !== "cancelled") ?? [];
  const totalSold = paidTickets.reduce((sum, ticket) => sum + (ticket.amount_paid_cents ?? 0), 0);
  const checkins = events?.reduce((sum, event) => sum + (event.checkins?.length ?? 0), 0) ?? 0;

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <div>
        <p className="text-sm font-bold uppercase text-[#ff1493]">Organizador</p>
        <h1 className="text-3xl font-black">{organizer.trade_name}</h1>
        <p className="text-[#c9aabc]">Status: {organizer.status}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total vendido" value={formatCurrency(totalSold)} tone="pink" />
        <StatCard label="Ingressos" value={String(paidTickets.length)} />
        <StatCard label="Check-ins" value={String(checkins)} tone="light" />
      </div>

      <section className="rounded-lg border border-[#ff1493]/30 bg-[#120410] shadow-sm shadow-[#ff1493]/10">
        <div className="border-b border-[#ff1493]/20 p-4">
          <h2 className="font-black">Eventos</h2>
        </div>
        <div className="divide-y divide-[#ff1493]/15">
          {events?.map((event) => (
            <div key={event.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <strong>{event.title}</strong>
                <p className="text-sm text-[#c9aabc]">{formatDateTime(event.starts_at)}</p>
              </div>
              <span className="text-sm font-medium">{event.status}</span>
              <div className="flex gap-2">
                <Link className="rounded-md border border-[#ff1493]/40 px-3 py-2 text-sm font-bold text-[#ff8ac4]" href={`/eventos/${event.slug}`}>
                  Ver
                </Link>
                <Link className="rounded-md bg-[#ff1493] px-3 py-2 text-sm font-bold text-white" href={`/api/organizer/export?eventId=${event.id}`}>
                  Exportar CSV
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function AuthMessage({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-6 shadow-sm shadow-[#ff1493]/10">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mt-2 text-[#c9aabc]">Entre com seu e-mail para acessar esta área.</p>
        <Link className="mt-5 inline-block rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white" href="/login">
          Entrar
        </Link>
      </div>
    </main>
  );
}
