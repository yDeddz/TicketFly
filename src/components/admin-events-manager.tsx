"use client";

import { CalendarClock, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { getErrorMessage } from "@/lib/client-errors";

type AdminEvent = {
  id: string;
  title: string;
  description: string | null;
  venue_name: string;
  address: string;
  city: string;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  status: "draft" | "published" | "cancelled" | "finished";
  organizers?: {
    trade_name: string;
  } | null;
};

type FormState = {
  title: string;
  description: string;
  venueName: string;
  address: string;
  city: string;
  startsAt: string;
  endsAt: string;
  coverImageUrl: string;
  status: AdminEvent["status"];
};

const statusLabels: Record<AdminEvent["status"], string> = {
  draft: "Rascunho",
  published: "Publicado",
  cancelled: "Cancelado",
  finished: "Finalizado",
};

const DESTRUCTIVE_STATUSES = new Set<AdminEvent["status"]>(["cancelled", "finished"]);

export function AdminEventsManager({ events }: { events: AdminEvent[] }) {
  const router = useRouter();
  const [forms, setForms] = useState<Record<string, FormState>>(() =>
    Object.fromEntries(events.map((event) => [event.id, eventToForm(event)])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);

  function updateField(id: string, field: keyof FormState, value: string) {
    setForms((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  }

  function requestSave(eventId: string) {
    const form = forms[eventId];
    const original = events.find((event) => event.id === eventId);
    if (form && original && form.status !== original.status && DESTRUCTIVE_STATUSES.has(form.status)) {
      setPendingSaveId(eventId);
      return;
    }
    void saveEvent(eventId);
  }

  async function saveEvent(eventId: string) {
    const form = forms[eventId];
    setPendingSaveId(null);
    setSavingId(eventId);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(getErrorMessage(body, "Não foi possível salvar o evento."));
        return;
      }

      setMessage("Evento atualizado com sucesso.");
      router.refresh();
    } catch {
      setMessage("Falha de rede ao salvar o evento.");
    } finally {
      setSavingId(null);
    }
  }

  if (!events.length) {
    return (
      <section className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-5 shadow-sm shadow-[#ff1493]/10">
        <h2 className="font-black">Editar eventos</h2>
        <p className="mt-2 text-sm text-[#c9aabc]">Nenhum evento cadastrado ainda.</p>
      </section>
    );
  }

  const pendingForm = pendingSaveId ? forms[pendingSaveId] : null;

  return (
    <section className="rounded-lg border border-[#ff1493]/30 bg-[#120410] shadow-sm shadow-[#ff1493]/10">
      <div className="flex flex-col gap-2 border-b border-[#ff1493]/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase text-[#ff1493]">
            <CalendarClock className="h-4 w-4" />
            Acesso administrativo
          </p>
          <h2 className="mt-1 text-xl font-black">Editar eventos e datas</h2>
        </div>
        {message ? <p className="text-sm font-bold text-[#ffb1d5]">{message}</p> : null}
      </div>

      <div className="divide-y divide-[#ff1493]/15">
        {events.map((event) => {
          const form = forms[event.id];
          const organizer = Array.isArray(event.organizers) ? event.organizers[0] : event.organizers;

          return (
            <form
              key={event.id}
              className="grid gap-4 p-5"
              onSubmit={(submitEvent) => {
                submitEvent.preventDefault();
                requestSave(event.id);
              }}
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
                <label className="grid gap-2 text-sm font-medium">
                  Evento
                  <input
                    required
                    value={form.title}
                    onChange={(changeEvent) => updateField(event.id, "title", changeEvent.target.value)}
                    className="h-11 rounded-md border border-white/10 px-3"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Início
                  <input
                    required
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(changeEvent) => updateField(event.id, "startsAt", changeEvent.target.value)}
                    className="h-11 rounded-md border border-white/10 px-3"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Término
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(changeEvent) => updateField(event.id, "endsAt", changeEvent.target.value)}
                    className="h-11 rounded-md border border-white/10 px-3"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_150px]">
                <label className="grid gap-2 text-sm font-medium">
                  Local
                  <input
                    required
                    value={form.venueName}
                    onChange={(changeEvent) => updateField(event.id, "venueName", changeEvent.target.value)}
                    className="h-11 rounded-md border border-white/10 px-3"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Endereço
                  <input
                    required
                    value={form.address}
                    onChange={(changeEvent) => updateField(event.id, "address", changeEvent.target.value)}
                    className="h-11 rounded-md border border-white/10 px-3"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Cidade
                  <input
                    required
                    value={form.city}
                    onChange={(changeEvent) => updateField(event.id, "city", changeEvent.target.value)}
                    className="h-11 rounded-md border border-white/10 px-3"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
                <label className="grid gap-2 text-sm font-medium">
                  Imagem de capa
                  <input
                    type="url"
                    value={form.coverImageUrl}
                    onChange={(changeEvent) => updateField(event.id, "coverImageUrl", changeEvent.target.value)}
                    className="h-11 rounded-md border border-white/10 px-3"
                    placeholder="https://..."
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Status
                  <select
                    value={form.status}
                    onChange={(changeEvent) => updateField(event.id, "status", changeEvent.target.value)}
                    className="h-11 rounded-md border border-white/10 px-3"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                Descrição
                <textarea
                  value={form.description}
                  onChange={(changeEvent) => updateField(event.id, "description", changeEvent.target.value)}
                  className="min-h-24 rounded-md border border-white/10 p-3"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#c9aabc]">{organizer?.trade_name ?? "Organizador não informado"}</p>
                <button
                  type="submit"
                  disabled={savingId === event.id}
                  className="neon-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar alterações
                </button>
              </div>
            </form>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(pendingSaveId)}
        title="Alterar status do evento?"
        description={
          pendingForm
            ? `O status será alterado para “${statusLabels[pendingForm.status]}”. Isso pode afetar vendas e a vitrine.`
            : undefined
        }
        confirmLabel="Salvar mesmo assim"
        tone="danger"
        busy={Boolean(savingId)}
        onCancel={() => setPendingSaveId(null)}
        onConfirm={() => {
          if (pendingSaveId) void saveEvent(pendingSaveId);
        }}
      />
    </section>
  );
}

function eventToForm(event: AdminEvent): FormState {
  return {
    title: event.title,
    description: event.description ?? "",
    venueName: event.venue_name,
    address: event.address,
    city: event.city,
    startsAt: toDateTimeLocal(event.starts_at),
    endsAt: event.ends_at ? toDateTimeLocal(event.ends_at) : "",
    coverImageUrl: event.cover_image_url ?? "",
    status: event.status,
  };
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}
