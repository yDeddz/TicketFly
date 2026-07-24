"use client";

import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatCurrency, formatDateTime } from "@/lib/format";

type EventItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  starts_at: string;
  venue_name: string;
  ticket_batches: Array<{
    id: string;
    name: string;
    price_cents: number;
    quantity_total: number;
    quantity_sold: number;
    quantity_reserved: number;
  }>;
};

export function OrganizerEventsManager({ events }: { events: EventItem[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    venueName: "",
    address: "",
    city: "",
    startsAt: "",
    endsAt: "",
    coverImageUrl: "",
  });
  const [batchForm, setBatchForm] = useState<Record<string, { name: string; priceCents: string; quantityTotal: string }>>({});

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/organizer/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        venueName: form.venueName,
        address: form.address,
        city: form.city,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
        coverImageUrl: form.coverImageUrl,
      }),
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Erro ao criar evento");
      return;
    }
    setShowCreate(false);
    setMessage("Evento criado como rascunho.");
    router.refresh();
  }

  async function publish(eventId: string) {
    setMessage("");
    const response = await fetch(`/api/organizer/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(body?.error ?? "Erro ao publicar");
      return;
    }
    setMessage("Evento publicado.");
    router.refresh();
  }

  async function createBatch(eventId: string) {
    const data = batchForm[eventId] ?? { name: "Pista", priceCents: "10000", quantityTotal: "100" };
    setBatchLoading(eventId);
    setMessage("");
    const response = await fetch("/api/organizer/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        name: data.name,
        priceCents: Number(data.priceCents),
        quantityTotal: Number(data.quantityTotal),
      }),
    });
    const body = await response.json().catch(() => null);
    setBatchLoading(null);
    if (!response.ok) {
      setMessage(body?.error ?? "Erro ao criar lote");
      return;
    }
    setMessage("Lote criado.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Eventos</h2>
          <p className="mt-1 text-sm text-[#c9aabc]">Crie noites, adicione lotes e publique quando estiver pronto.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          Novo evento
        </button>
      </div>

      {message ? <p className="rounded-xl border border-[#ff1493]/25 bg-[#ff1493]/10 px-4 py-3 text-sm text-[#ffb1d5]">{message}</p> : null}

      {showCreate ? (
        <form onSubmit={createEvent} className="grid gap-3 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm md:col-span-2">
            Título
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3" />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            Descrição
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="rounded-md border border-white/10 bg-[#0d0b10] px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm">
            Local
            <input required value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3" />
          </label>
          <label className="grid gap-2 text-sm">
            Cidade
            <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3" />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            Endereço
            <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3" />
          </label>
          <label className="grid gap-2 text-sm">
            Início
            <input required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3" />
          </label>
          <label className="grid gap-2 text-sm">
            Fim (opcional)
            <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3" />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            URL da capa (opcional)
            <input type="url" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3" />
          </label>
          <button disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 md:col-span-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar evento
          </button>
        </form>
      ) : null}

      <div className="grid gap-4">
        {events.map((event) => {
          const batch = batchForm[event.id] ?? { name: "Pista", priceCents: "10000", quantityTotal: "200" };
          return (
            <div key={event.id} className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="text-lg">{event.title}</strong>
                  <p className="text-sm text-white/50">
                    {formatDateTime(event.starts_at)} · {event.venue_name} · {event.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/eventos/${event.slug}`} className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/75">
                    Ver página
                  </Link>
                  <Link href={`/api/organizer/export?eventId=${event.id}`} className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/75">
                    Exportar CSV
                  </Link>
                  {event.status !== "published" ? (
                    <button type="button" onClick={() => publish(event.id)} className="cursor-pointer rounded-full bg-[#ff1493] px-3 py-2 text-xs font-bold text-white">
                      Publicar
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {(event.ticket_batches ?? []).map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm">
                    <span>
                      {item.name} · {formatCurrency(item.price_cents)}
                    </span>
                    <span className="text-white/50">
                      {item.quantity_sold} vendidos · {item.quantity_reserved} reservados · {item.quantity_total} total
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2 rounded-xl border border-white/10 p-3 md:grid-cols-4">
                <input
                  value={batch.name}
                  onChange={(e) => setBatchForm((c) => ({ ...c, [event.id]: { ...batch, name: e.target.value } }))}
                  className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm"
                  placeholder="Nome do lote"
                />
                <input
                  type="number"
                  value={batch.priceCents}
                  onChange={(e) => setBatchForm((c) => ({ ...c, [event.id]: { ...batch, priceCents: e.target.value } }))}
                  className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm"
                  placeholder="Preço (centavos)"
                />
                <input
                  type="number"
                  value={batch.quantityTotal}
                  onChange={(e) => setBatchForm((c) => ({ ...c, [event.id]: { ...batch, quantityTotal: e.target.value } }))}
                  className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm"
                  placeholder="Quantidade"
                />
                <button
                  type="button"
                  disabled={batchLoading === event.id}
                  onClick={() => createBatch(event.id)}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-white/10 px-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {batchLoading === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar lote
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
