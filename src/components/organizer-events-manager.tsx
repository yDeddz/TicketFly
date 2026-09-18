"use client";

import { Loader2, Pencil, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { AlertBanner } from "@/components/ui/alert-banner";
import { getErrorMessage } from "@/lib/client-errors";
import { dateTimeLocalToIso, formatCurrency, formatDateTime, reaisToCents, toDateTimeLocal } from "@/lib/format";

type BatchItem = {
  id: string;
  name: string;
  price_cents: number;
  quantity_total: number;
  quantity_sold: number;
  quantity_reserved: number;
  is_active: boolean;
  sales_end_at: string | null;
};

type EventItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  description: string | null;
  venue_name: string;
  address: string;
  city: string;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  ticket_batches: BatchItem[];
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  cancelled: "Cancelado",
  finished: "Finalizado",
};

export function OrganizerEventsManager({
  events,
  paymentsReady,
}: {
  events: EventItem[];
  paymentsReady: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState<string | null>(null);
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ id: string; status: "published" | "draft" | "cancelled" | "finished" } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");
  const [form, setForm] = useState({
    title: "",
    description: "",
    venueName: "",
    address: "",
    city: "",
    startsAt: "",
    endsAt: "",
    coverImageUrl: "",
    batchName: "Pista",
    batchPrice: "100,00",
    batchQty: "200",
  });
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    venueName: "",
    address: "",
    city: "",
    startsAt: "",
    endsAt: "",
    coverImageUrl: "",
  });
  const [batchForm, setBatchForm] = useState<Record<string, { name: string; priceReais: string; quantityTotal: string }>>({});

  function flash(tone: "info" | "success" | "error", text: string) {
    setMessageTone(tone);
    setMessage(text);
  }

  async function uploadCover(file: File, target: "create" | "edit") {
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/organizer/uploads/cover", { method: "POST", body: data });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      flash("error", getErrorMessage(body, "Falha no upload da capa"));
      return;
    }
    const url = String(body.url ?? "");
    if (target === "create") setForm((current) => ({ ...current, coverImageUrl: url }));
    else setEditForm((current) => ({ ...current, coverImageUrl: url }));
    flash("success", "Capa enviada.");
  }

  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    const priceCents = reaisToCents(form.batchPrice);
    if (priceCents === null) {
      flash("error", "Informe um preço válido do lote (ex.: 80,00).");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          venueName: form.venueName,
          address: form.address,
          city: form.city,
          startsAt: dateTimeLocalToIso(form.startsAt),
          endsAt: form.endsAt ? dateTimeLocalToIso(form.endsAt) : "",
          coverImageUrl: form.coverImageUrl,
          batch: {
            name: form.batchName,
            priceCents,
            quantityTotal: Number(form.batchQty),
          },
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        flash("error", getErrorMessage(body, "Erro ao criar evento"));
        return;
      }
      setShowCreate(false);
      flash("success", body.batchWarning ?? "Evento criado como rascunho com o primeiro lote.");
      router.refresh();
    } catch {
      flash("error", "Falha de rede ao criar evento.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(event: EventItem) {
    setEditingId(event.id);
    setEditForm({
      title: event.title,
      description: event.description ?? "",
      venueName: event.venue_name,
      address: event.address,
      city: event.city,
      startsAt: toDateTimeLocal(event.starts_at),
      endsAt: event.ends_at ? toDateTimeLocal(event.ends_at) : "",
      coverImageUrl: event.cover_image_url ?? "",
    });
  }

  async function saveEvent(eventId: string) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/organizer/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          venueName: editForm.venueName,
          address: editForm.address,
          city: editForm.city,
          startsAt: dateTimeLocalToIso(editForm.startsAt),
          endsAt: editForm.endsAt ? dateTimeLocalToIso(editForm.endsAt) : "",
          coverImageUrl: editForm.coverImageUrl,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        flash("error", getErrorMessage(body, "Erro ao salvar evento"));
        return;
      }
      setEditingId(null);
      flash("success", "Evento atualizado.");
      router.refresh();
    } catch {
      flash("error", "Falha de rede ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmStatus() {
    if (!pendingAction) return;
    const event = events.find((item) => item.id === pendingAction.id);
    if (pendingAction.status === "published") {
      if (!paymentsReady) {
        setPendingAction(null);
        flash("error", "Conecte Asaas ou Mercado Pago em Pagamentos antes de publicar.");
        return;
      }
      if ((event?.ticket_batches.filter((batch) => batch.is_active).length ?? 0) === 0) {
        setPendingAction(null);
        flash("error", "Adicione pelo menos um lote ativo antes de publicar.");
        return;
      }
    }
    const eventId = pendingAction.id;
    const status = pendingAction.status;
    setPendingAction(null);
    setPublishBusyId(eventId);
    setMessage("");
    try {
      const response = await fetch(`/api/organizer/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        flash("error", getErrorMessage(body, "Erro ao atualizar status"));
        return;
      }
      flash("success", `Evento ${statusLabels[status]?.toLowerCase() ?? status}.`);
      router.refresh();
    } catch {
      flash("error", "Falha de rede ao atualizar status.");
    } finally {
      setPublishBusyId(null);
    }
  }

  async function createBatch(eventId: string) {
    const data = batchForm[eventId] ?? { name: "Pista", priceReais: "100,00", quantityTotal: "100" };
    const priceCents = reaisToCents(data.priceReais);
    if (priceCents === null) {
      flash("error", "Informe um preço válido em reais (ex.: 80,00).");
      return;
    }
    setBatchLoading(eventId);
    setMessage("");
    try {
      const response = await fetch("/api/organizer/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          name: data.name,
          priceCents,
          quantityTotal: Number(data.quantityTotal),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        flash("error", getErrorMessage(body, "Erro ao criar lote"));
        return;
      }
      flash("success", "Lote criado.");
      router.refresh();
    } catch {
      flash("error", "Falha de rede ao criar lote.");
    } finally {
      setBatchLoading(null);
    }
  }

  async function patchBatch(batchId: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/organizer/batches/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      flash("error", getErrorMessage(body, "Erro ao atualizar lote"));
      return;
    }
    flash("success", "Lote atualizado.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Eventos</h2>
          <p className="mt-1 text-sm text-[#c9aabc]">Crie a noite, o primeiro lote e publique quando o recebimento estiver pronto.</p>
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

      {!paymentsReady ? (
        <AlertBanner tone="warning">
          Sem Asaas/Mercado Pago conectado a publicação fica bloqueada — senão o dinheiro cairia na conta da plataforma.{" "}
          <Link href="/organizador/pagamentos" className="font-bold underline">
            Configurar pagamentos
          </Link>
        </AlertBanner>
      ) : null}

      {message ? <AlertBanner tone={messageTone}>{message}</AlertBanner> : null}

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
            Capa (upload ou URL https)
            <input type="url" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3" placeholder="https://..." />
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && void uploadCover(e.target.files[0], "create")} className="text-xs text-white/60" />
          </label>
          <p className="md:col-span-2 text-sm font-bold text-white/70">Primeiro lote</p>
          <input value={form.batchName} onChange={(e) => setForm({ ...form, batchName: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm" placeholder="Nome do lote" required />
          <input inputMode="decimal" value={form.batchPrice} onChange={(e) => setForm({ ...form, batchPrice: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm" placeholder="Preço (R$)" required />
          <input type="number" min={1} value={form.batchQty} onChange={(e) => setForm({ ...form, batchQty: e.target.value })} className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm md:col-span-2" placeholder="Quantidade" required />
          <button disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 md:col-span-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar evento e lote
          </button>
        </form>
      ) : null}

      {events.length === 0 && !showCreate ? (
        <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-white/60">
          Nenhum evento ainda. Crie o primeiro com um lote; a publicação só libera com recebimento conectado.
        </p>
      ) : null}

      <div className="grid gap-4">
        {events.map((event) => {
          const batch = batchForm[event.id] ?? { name: "Pista", priceReais: "100,00", quantityTotal: "200" };
          const publishBusy = publishBusyId === event.id;
          const editing = editingId === event.id;
          return (
            <div key={event.id} className="rounded-2xl border border-[#ff1493]/25 bg-[#120410] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="text-lg">{event.title}</strong>
                  <p className="text-sm text-white/50">
                    {formatDateTime(event.starts_at)} · {event.venue_name} · {statusLabels[event.status] ?? event.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/eventos/${event.slug}`} className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/75">
                    Ver página
                  </Link>
                  <Link href={`/api/organizer/export?eventId=${event.id}`} className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/75">
                    Exportar CSV
                  </Link>
                  <button type="button" onClick={() => (editing ? setEditingId(null) : startEdit(event))} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/75">
                    <Pencil className="h-3.5 w-3.5" />
                    {editing ? "Fechar" : "Editar"}
                  </button>
                  {event.status !== "published" ? (
                    <button type="button" disabled={publishBusy} onClick={() => setPendingAction({ id: event.id, status: "published" })} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#ff1493] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                      {publishBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Publicar
                    </button>
                  ) : (
                    <button type="button" disabled={publishBusy} onClick={() => setPendingAction({ id: event.id, status: "draft" })} className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/75">
                      Despublicar
                    </button>
                  )}
                  {event.status !== "cancelled" && event.status !== "finished" ? (
                    <button type="button" onClick={() => setPendingAction({ id: event.id, status: "cancelled" })} className="rounded-full border border-red-400/30 px-3 py-2 text-xs font-bold text-red-200">
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>

              {editing ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm md:col-span-2" />
                  <input value={editForm.venueName} onChange={(e) => setEditForm({ ...editForm, venueName: e.target.value })} className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm" />
                  <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm" />
                  <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm md:col-span-2" />
                  <input type="datetime-local" value={editForm.startsAt} onChange={(e) => setEditForm({ ...editForm, startsAt: e.target.value })} className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm" />
                  <input type="datetime-local" value={editForm.endsAt} onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })} className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm" />
                  <input type="url" value={editForm.coverImageUrl} onChange={(e) => setEditForm({ ...editForm, coverImageUrl: e.target.value })} className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm md:col-span-2" placeholder="URL da capa" />
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && void uploadCover(e.target.files[0], "edit")} className="text-xs text-white/60 md:col-span-2" />
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="rounded-md border border-white/10 bg-[#0d0b10] px-3 py-2 text-sm md:col-span-2" />
                  <button type="button" disabled={loading} onClick={() => void saveEvent(event.id)} className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar alterações
                  </button>
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                {(event.ticket_batches ?? []).length === 0 ? (
                  <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                    Sem lote ativo — a publicação fica bloqueada até você adicionar um.
                  </p>
                ) : null}
                {(event.ticket_batches ?? []).map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm">
                    <span>
                      {item.name} · {formatCurrency(item.price_cents)}
                      {!item.is_active ? <span className="ml-2 text-amber-200">inativo</span> : null}
                    </span>
                    <span className="text-white/50">
                      {item.quantity_sold} vendidos · {item.quantity_reserved} reservados · {item.quantity_total} total
                    </span>
                    <button
                      type="button"
                      onClick={() => void patchBatch(item.id, { isActive: !item.is_active })}
                      className="text-xs font-bold text-[#ff7ec8]"
                    >
                      {item.is_active ? "Desativar" : "Reativar"}
                    </button>
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
                  inputMode="decimal"
                  value={batch.priceReais}
                  onChange={(e) => setBatchForm((c) => ({ ...c, [event.id]: { ...batch, priceReais: e.target.value } }))}
                  className="h-10 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-sm"
                  placeholder="Preço (R$)"
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

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction?.status === "published"
            ? "Publicar evento?"
            : pendingAction?.status === "cancelled"
              ? "Cancelar evento?"
              : "Despublicar evento?"
        }
        description={
          pendingAction?.status === "published"
            ? !paymentsReady
              ? "A conta de recebimento ainda não está pronta. A TicketFly está configurando isso para você."
              : (events.find((item) => item.id === pendingAction.id)?.ticket_batches.filter((b) => b.is_active).length ?? 0) === 0
                ? "Este evento ainda não tem lote ativo."
                : "O evento ficará visível na vitrine e poderá receber compras imediatamente."
            : pendingAction?.status === "cancelled"
              ? "O evento sai da vitrine. Ingressos já pagos continuam válidos até reembolso."
              : "O evento volta para rascunho e some da vitrine."
        }
        confirmLabel={pendingAction?.status === "cancelled" ? "Cancelar evento" : "Confirmar"}
        tone={pendingAction?.status === "cancelled" ? "danger" : "primary"}
        busy={Boolean(publishBusyId)}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void confirmStatus()}
      />
    </div>
  );
}
