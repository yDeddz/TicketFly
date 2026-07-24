import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { DashboardNav } from "@/components/dashboard-nav";
import { requireAdmin } from "@/lib/auth-guards";

const nav = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/contratos", label: "Contratos" },
  { href: "/admin/eventos", label: "Eventos" },
  { href: "/admin/ingressos", label: "Ingressos" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAdmin();

  if (auth.error) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-12 pt-8">
        <div className="rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-6">
          <h1 className="text-2xl font-black">Administração TicketFly</h1>
          <p className="mt-2 text-[#c9aabc]">{auth.error}</p>
          <Link className="mt-5 inline-block rounded-full bg-[#ff1493] px-4 py-3 text-sm font-bold text-white" href="/login">
            Entrar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 lg:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <BrandLogo className="h-8 w-8" href="/" variant="mark" />
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">TicketFly Ops</p>
          </div>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Painel administrativo</h1>
          <p className="mt-2 text-sm text-white/55">Contratos, vendas, ingressos e reembolsos em um só lugar.</p>
        </div>
      </div>
      <div className="mb-8">
        <DashboardNav items={nav} base="/admin" />
      </div>
      {children}
    </div>
  );
}
