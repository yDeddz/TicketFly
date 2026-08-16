"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { TicketStatusBadge } from "@/components/status-badges";
import { AlertBanner } from "@/components/ui/alert-banner";
import { getErrorMessage } from "@/lib/client-errors";
import { formatCurrency, formatDateTime } from "@/lib/format";

export type TicketRow = {
  id: string;
  code: string;
  buyer_name: string;
  buyer_email: string;
  status: string;
  amount_paid_cents: number;
  used_at: string | null;
  created_at: string;
  events: { title: string } | null;
  ticket_batches: { name: string } | null;
};

export function TicketsOperationsTable({
  tickets,
  mode,
}: {
  tickets: TicketRow[];
  mode: "admin" | "organizer";
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "warning" | "error">("info");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingRefundId, setPendingRefundId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");

  const filtered = tickets.filter((ticket) => {
    const haystack = `${ticket.buyer_name} ${ticket.buyer_email} ${ticket.code} ${ticket.events?.title ?? ""}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  function requestRefund(ticketId: string) {
    setPendingRefundId(ticketId);
    setRefundReason("");
  }

  async function confirmRefund() {
    if (!pendingRefundId) return;
    const ticketId = pendingRefundId;
    setBusyId(ticketId);
    setMessage("");
    setPendingRefundId(null);

    const endpoint =
      mode === "admin"
        ? `/api/admin/tickets/${ticketId}/refund`
        : `/api/organizer/tickets/${ticketId}/refund`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessageTone("error");
        setMessage(getErrorMessage(body, "Falha no reembolso."));
        return;
      }
      if (body?.partial) {
        setMessageTone("warning");
        setMessage(body.message ?? "Ingresso cancelado, mas o estorno no provedor falhou.");
      } else {
        setMessageTone("success");
        setMessage(body?.message ?? "Reembolso registrado.");
      }
      router.refresh();
    } catch {
      setMessageTone("error");
      setMessage("Falha de rede ao reembolsar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar comprador, e-mail, código ou evento"
          className="h-11 min-w-[16rem] flex-1 rounded-xl border border-white/10 bg-[#0d0b10] px-3 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 rounded-xl border border-white/10 bg-[#0d0b10] px-3 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="paid">Pago · QR livre</option>
          <option value="used">Usado · QR validado</option>
          <option value="pending">Pendente</option>
          <option value="cancelled">Cancelado / reembolsado</option>
        </select>
      </div>

      {message ? <AlertBanner tone={messageTone}>{message}</AlertBanner> : null}

      <div className="overflow-hidden rounded-2xl border border-[#ff1493]/25 bg-[#120410]">
        <div className="overflow-x-auto">
          <table className="hidden min-w-full text-left text-sm md:table">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-4 py-3 font-bold">Comprador</th>
                <th className="px-4 py-3 font-bold">Evento / lote</th>
                <th className="px-4 py-3 font-bold">QR / status</th>
                <th className="px-4 py-3 font-bold">Valor</th>
                <th className="px-4 py-3 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => {
                const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;
                const batch = Array.isArray(ticket.ticket_batches) ? ticket.ticket_batches[0] : ticket.ticket_batches;
                const busy = busyId === ticket.id;
                const canRefund = ticket.status === "paid" || ticket.status === "used" || ticket.status === "pending";
                return (
                  <tr key={ticket.id} className="border-b border-white/8 align-top last:border-0">
                    <td className="px-4 py-4">
                      <strong className="text-white">{ticket.buyer_name}</strong>
                      <p className="text-xs text-white/50">{ticket.buyer_email}</p>
                      <p className="mt-1 font-mono text-[11px] text-white/35">{ticket.code.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-white/90">{event?.title ?? "—"}</p>
                      <p className="text-xs text-white/50">{batch?.name ?? "Lote"}</p>
                      <p className="mt-1 text-xs text-white/40">{formatDateTime(ticket.created_at)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <TicketStatusBadge status={ticket.status} />
                      {ticket.used_at ? (
                        <p className="mt-2 text-xs text-sky-200/80">Validado em {formatDateTime(ticket.used_at)}</p>
                      ) : ticket.status === "paid" ? (
                        <p className="mt-2 text-xs text-emerald-200/80">Aguardando entrada</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 font-bold">{formatCurrency(ticket.amount_paid_cents)}</td>
                    <td className="px-4 py-4">
                      {canRefund ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => requestRefund(ticket.id)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/80 transition hover:border-[#ff1493]/40 hover:text-white disabled:opacity-60"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          Reembolsar
                        </button>
                      ) : (
                        <span className="text-xs text-white/35">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-white/45">
                    Nenhum ingresso encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="grid gap-3 p-3 md:hidden">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/45">Nenhum ingresso encontrado.</p>
            ) : (
              filtered.map((ticket) => {
                const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;
                const batch = Array.isArray(ticket.ticket_batches) ? ticket.ticket_batches[0] : ticket.ticket_batches;
                const busy = busyId === ticket.id;
                const canRefund = ticket.status === "paid" || ticket.status === "used" || ticket.status === "pending";
                return (
                  <div key={ticket.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-white">{ticket.buyer_name}</strong>
                        <p className="text-xs text-white/50">{ticket.buyer_email}</p>
                      </div>
                      <TicketStatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-2 text-sm text-white/70">{event?.title ?? "—"} · {batch?.name ?? "Lote"}</p>
                    <p className="mt-1 font-bold">{formatCurrency(ticket.amount_paid_cents)}</p>
                    {canRefund ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => requestRefund(ticket.id)}
                        className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/80 disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Reembolsar
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingRefundId)}
        title="Confirmar reembolso"
        description="Esta ação cancela o ingresso e tenta estornar o pagamento no provedor. Não pode ser desfeita."
        confirmLabel="Reembolsar agora"
        tone="danger"
        busy={busyId === pendingRefundId}
        onCancel={() => setPendingRefundId(null)}
        onConfirm={() => void confirmRefund()}
      >
        <label className="grid gap-2 text-sm text-white/70">
          Motivo (opcional)
          <input
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            maxLength={500}
            placeholder="Ex.: evento cancelado, pedido do comprador…"
            className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3 text-white"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
