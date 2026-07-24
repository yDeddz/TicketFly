import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { DashboardNav } from "@/components/dashboard-nav";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nav = [
  { href: "/organizador", label: "Dashboard" },
  { href: "/organizador/eventos", label: "Eventos" },
  { href: "/organizador/promotores", label: "Promotores" },
  { href: "/organizador/cupons", label: "Cupons" },
  { href: "/organizador/ingressos", label: "Ingressos / QR" },
  { href: "/organizador/entradas", label: "Gestão de entrada" },
  { href: "/organizador/pagamentos", label: "Pagamentos" },
  { href: "/organizador/reembolsos", label: "Reembolsos" },
  { href: "/organizador/webhooks", label: "Webhooks" },
];

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-12 pt-8">
        <div className="rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-6">
          <h1 className="text-2xl font-black">Painel do parceiro</h1>
          <p className="mt-2 text-[#c9aabc]">Entre para gerenciar eventos, QR Codes e reembolsos.</p>
          <div className="mt-5 flex gap-3">
            <Link className="rounded-full bg-[#ff1493] px-4 py-3 text-sm font-bold text-white" href="/login">
              Entrar
            </Link>
            <Link className="rounded-full border border-white/15 px-4 py-3 text-sm font-bold text-white/75" href="/parceiros">
              Quero ser parceiro
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: organizer } = await admin
    .from("organizers")
    .select("id,status,trade_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizer) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-12 pt-8">
        <div className="rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-6">
          <h1 className="text-2xl font-black">Torne-se parceiro</h1>
          <p className="mt-2 text-[#c9aabc]">Você ainda não tem contrato. Candidate-se para anunciar sua balada.</p>
          <Link className="mt-5 inline-block rounded-full bg-[#ff1493] px-4 py-3 text-sm font-bold text-white" href="/parceiros#candidatura">
            Quero ser parceiro
          </Link>
        </div>
      </main>
    );
  }

  if (organizer.status !== "approved") {
    return (
      <main className="mx-auto max-w-xl px-4 pb-12 pt-8">
        <div className="rounded-2xl border border-amber-400/25 bg-[#120410] p-6">
          <h1 className="text-2xl font-black">{organizer.trade_name}</h1>
          <p className="mt-2 text-amber-100/90">
            Status: <strong>{organizer.status}</strong>. Assim que o contrato for aprovado, o dashboard completo libera.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 lg:px-6">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <BrandLogo className="h-8 w-8" href="/" variant="mark" />
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">Parceiro TicketFly</p>
        </div>
        <h1 className="mt-2 text-3xl font-black md:text-4xl">{organizer.trade_name}</h1>
        <p className="mt-2 text-sm text-white/55">Vendas, porta, QR Code e reembolsos com visão operacional.</p>
      </div>
      <div className="mb-8">
        <DashboardNav items={nav} base="/organizador" />
      </div>
      {children}
    </div>
  );
}
