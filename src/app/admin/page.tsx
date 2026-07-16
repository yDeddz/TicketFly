import Link from "next/link";

import { AdminEventsManager } from "@/components/admin-events-manager";
import { StatCard } from "@/components/stat-card";
import { hasSupabaseConfig } from "@/lib/env";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <Message text="Configure o Supabase e a service role para liberar a administracao." />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Message text="Login obrigatorio para acessar a administracao." showLogin />;
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return <Message text="Esta area e restrita a administradores." />;
  }

  const admin = createAdminClient();
  const [{ data: events }, { data: payments }, { data: organizers }] = await Promise.all([
    admin
      .from("events")
      .select("id,title,description,venue_name,address,city,starts_at,ends_at,cover_image_url,status,organizers(trade_name)")
      .order("starts_at", { ascending: false }),
    admin.from("payments").select("amount_cents,platform_fee_cents,status"),
    admin.from("organizers").select("id,trade_name,status,created_at").order("created_at", { ascending: false }),
  ]);

  const approvedPayments = payments?.filter((payment) => payment.status === "approved") ?? [];
  const totalSold = approvedPayments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  const platformFee = approvedPayments.reduce((sum, payment) => sum + payment.platform_fee_cents, 0);
  const adminEvents =
    events?.map((event) => ({
      ...event,
      organizers: Array.isArray(event.organizers) ? event.organizers[0] ?? null : event.organizers ?? null,
    })) ?? [];

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <div>
        <p className="text-sm font-bold uppercase text-[#ff1493]">Administracao</p>
        <h1 className="text-3xl font-black">Visao geral</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total vendido" value={formatCurrency(totalSold)} tone="pink" />
        <StatCard label="Comissao" value={formatCurrency(platformFee)} />
        <StatCard label="Eventos" value={String(events?.length ?? 0)} tone="light" />
        <StatCard label="Organizadores" value={String(organizers?.length ?? 0)} tone="light" />
      </div>

      <AdminEventsManager events={adminEvents} />

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Organizadores">
          {organizers?.map((organizer) => (
            <div key={organizer.id} className="flex items-center justify-between border-b border-[#ff1493]/15 py-3 last:border-0">
              <div>
                <strong>{organizer.trade_name}</strong>
                <p className="text-sm text-[#c9aabc]">{formatDateTime(organizer.created_at)}</p>
              </div>
              <span className="text-sm font-bold">{organizer.status}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Eventos">
          {events?.map((event) => {
            const organizer = Array.isArray(event.organizers) ? event.organizers[0] : event.organizers;
            return (
              <div key={event.id} className="flex items-center justify-between border-b border-[#ff1493]/15 py-3 last:border-0">
                <div>
                  <strong>{event.title}</strong>
                  <p className="text-sm text-[#c9aabc]">{organizer?.trade_name}</p>
                </div>
                <span className="text-sm font-bold">{event.status}</span>
              </div>
            );
          })}
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-5 shadow-sm shadow-[#ff1493]/10">
      <h2 className="mb-3 font-black">{title}</h2>
      {children}
    </div>
  );
}

function Message({ text, showLogin = false }: { text: string; showLogin?: boolean }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-6 shadow-sm shadow-[#ff1493]/10">
        <h1 className="text-2xl font-black">Administracao</h1>
        <p className="mt-2 text-[#c9aabc]">{text}</p>
        {showLogin ? (
          <Link className="mt-5 inline-block rounded-md bg-[#ff1493] px-4 py-3 font-bold text-white" href="/login">
            Entrar
          </Link>
        ) : null}
      </div>
    </main>
  );
}
