import Link from "next/link";
import { redirect } from "next/navigation";

import {
  OrganizerDoorSalesManager,
  type DoorSaleEvent,
} from "@/components/organizer-door-sales-manager";
import { AlertBanner } from "@/components/ui/alert-banner";
import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DoorSalesPage() {
  const auth = await requireApprovedOrganizer();
  if (!auth.user) redirect("/login?next=/organizador/vendas-na-entrada");

  if (auth.error || !auth.organizer) {
    return <AlertBanner tone="error">{auth.error ?? "Organizador obrigatório"}</AlertBanner>;
  }

  const admin = createAdminClient();
  const [{ data: organizer }, { data: events }] = await Promise.all([
    admin
      .from("organizers")
      .select("asaas_connection_status,asaas_wallet_id")
      .eq("id", auth.organizer.id)
      .single(),
    admin
      .from("events")
      .select(
        "id,title,starts_at,status,ticket_batches(id,name,price_cents,quantity_total,quantity_sold,quantity_reserved,is_active,sales_start_at,sales_end_at)",
      )
      .eq("organizer_id", auth.organizer.id)
      .eq("status", "published")
      .order("starts_at", { ascending: true }),
  ]);

  const asaasReady =
    organizer?.asaas_connection_status === "connected" &&
    Boolean(organizer.asaas_wallet_id);

  const options: DoorSaleEvent[] = (events ?? [])
    .map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      batches: (event.ticket_batches ?? [])
        .filter(
          (batch) => batch.is_active,
        )
        .map((batch) => ({
          id: batch.id,
          name: batch.name,
          priceCents: batch.price_cents,
          quantityTotal: batch.quantity_total,
          quantitySold: batch.quantity_sold,
          quantityReserved: batch.quantity_reserved,
        })),
    }))
    .filter((event) => event.batches.length > 0);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">
          Operação presencial
        </p>
        <h2 className="mt-2 text-3xl font-black">Venda presencial</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#c9aabc]">
          Escolha o ingresso, cadastre o comprador e gere PIX ou link seguro de cartão em
          segundos.
        </p>
      </div>

      {!asaasReady ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
          <h3 className="font-black text-amber-100">Conecte o Asaas para vender na porta</h3>
          <p className="mt-2 text-sm text-amber-100/75">
            O Asaas processa PIX e cartão e repassa automaticamente o valor da venda para sua
            carteira.
          </p>
          <Link
            href="/organizador/pagamentos"
            className="mt-4 inline-flex rounded-full bg-[#ff1493] px-4 py-3 text-sm font-bold text-white"
          >
            Configurar pagamentos
          </Link>
        </div>
      ) : (
        <OrganizerDoorSalesManager events={options} />
      )}
    </div>
  );
}

