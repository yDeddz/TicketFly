import { redirect } from "next/navigation";

import {
  OrganizerDoorSalesManager,
  type DoorSaleEvent,
} from "@/components/organizer-door-sales-manager";
import { AlertBanner } from "@/components/ui/alert-banner";
import { requireApprovedOrganizer } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** ponytail: flip to true to restore the live door-sale form. Code stays; UI stays paused. */
const DOOR_SALES_ENABLED: boolean = false;

export default async function DoorSalesPage() {
  const auth = await requireApprovedOrganizer();
  if (!auth.user) redirect("/login?next=/organizador/vendas-na-entrada");

  if (auth.error || !auth.organizer) {
    return <AlertBanner tone="error">{auth.error ?? "Organizador obrigatório"}</AlertBanner>;
  }

  if (!DOOR_SALES_ENABLED) {
    return (
      <div className="grid max-w-2xl gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">
            Operação presencial
          </p>
          <h2 className="mt-2 text-3xl font-black">Venda presencial</h2>
        </div>
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Em breve</p>
          <h3 className="mt-2 text-xl font-black text-amber-50">Bilheteria na porta ainda não está no ar</h3>
          <p className="mt-3 text-sm leading-6 text-amber-100/80">
            A venda na entrada fica pausada por enquanto. Ingressos continuam na vitrine online, e a
            validação do QR segue em Gestão de entrada.
          </p>
        </div>
      </div>
    );
  }

  return <DoorSalesLive organizerId={auth.organizer.id} />;
}

async function DoorSalesLive({ organizerId }: { organizerId: string }) {

  const admin = createAdminClient();
  const [{ data: organizer }, { data: events }] = await Promise.all([
    admin
      .from("organizers")
      .select("pagarme_connection_status")
      .eq("id", organizerId)
      .single(),
    admin
      .from("events")
      .select(
        "id,title,starts_at,status,ticket_batches(id,name,price_cents,quantity_total,quantity_sold,quantity_reserved,is_active,sales_start_at,sales_end_at)",
      )
      .eq("organizer_id", organizerId)
      .eq("status", "published")
      .order("starts_at", { ascending: true }),
  ]);

  const pagarmeReady = organizer?.pagarme_connection_status === "connected";

  const options: DoorSaleEvent[] = (events ?? [])
    .map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      batches: (event.ticket_batches ?? [])
        .filter((batch) => {
          if (!batch.is_active) return false;
          const now = Date.now();
          if (new Date(batch.sales_start_at).getTime() > now) return false;
          if (batch.sales_end_at && new Date(batch.sales_end_at).getTime() < now) return false;
          return true;
        })
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
          Escolha o ingresso, cadastre o comprador e envie o pagamento em segundos.
        </p>
      </div>

      {!pagarmeReady ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
          <h3 className="font-black text-amber-100">Bilheteria ainda não disponível</h3>
          <p className="mt-2 text-sm text-amber-100/75">
            Fale com a TicketFly para liberar a venda presencial nesta casa.
          </p>
        </div>
      ) : (
        <OrganizerDoorSalesManager events={options} />
      )}
    </div>
  );
}

