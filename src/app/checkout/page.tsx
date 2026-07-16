import { CheckoutForm } from "@/components/checkout-form";
import { showcaseEvents } from "@/lib/ticketfly-data";
import { formatDateTime } from "@/lib/format";

export default function CheckoutPage() {
  const event = showcaseEvents[0];

  return (
    <main className="ticket-grid px-4 pb-16 pt-28 lg:px-6">
      <section className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_430px] lg:items-start">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#111014]">
          <div
            className="h-72 bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(5,5,5,0.08), rgba(5,5,5,0.86)), url(${event.cover_image_url})`,
            }}
          />
          <div className="grid gap-6 p-6">
            <div>
              <p className="text-sm font-black uppercase text-[#ff1493]">Checkout TicketFly</p>
              <h1 className="mt-2 text-4xl font-black">{event.title}</h1>
              <p className="mt-3 text-white/62">{formatDateTime(event.starts_at)} - {event.venue_name}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Trust label="Ambiente" value="Seguro" />
              <Trust label="Ingresso" value="Digital" />
              <Trust label="Entrega" value="E-mail" />
            </div>
          </div>
        </div>

        <CheckoutForm batches={event.ticket_batches} demoMode />
      </section>
    </main>
  );
}

function Trust({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-bold uppercase text-white/42">{label}</p>
      <strong className="mt-1 block text-xl text-white">{value}</strong>
    </div>
  );
}
