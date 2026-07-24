"use client";

import { useEffect, useState, useTransition } from "react";

import { ORGANIZER_WEBHOOK_EVENTS, type OrganizerWebhookEvent } from "@/lib/organizer-webhook-events";

type Delivery = {
  id: string;
  event_type: string;
  status: string;
  attempts: number;
  response_status: number | null;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
};

type WebhookConfig = {
  webhook_url: string | null;
  webhook_secret: string | null;
  webhook_enabled: boolean;
  webhook_events: OrganizerWebhookEvent[];
  deliveries: Delivery[];
};

const EVENT_LABELS: Record<OrganizerWebhookEvent, string> = {
  "sale.completed": "Venda concluída",
  "sale.refunded": "Reembolso",
  "event.created": "Evento criado",
  "event.updated": "Evento atualizado",
  "event.published": "Evento publicado",
  "event.cancelled": "Evento cancelado",
};

export function OrganizerWebhookSettings() {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<OrganizerWebhookEvent[]>([...ORGANIZER_WEBHOOK_EVENTS]);
  const [secretVisible, setSecretVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch("/api/organizer/webhooks");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao carregar webhook");
      return;
    }
    setConfig(data);
    setUrl(data.webhook_url ?? "");
    setEnabled(Boolean(data.webhook_enabled));
    setEvents((data.webhook_events as OrganizerWebhookEvent[]) ?? [...ORGANIZER_WEBHOOK_EVENTS]);
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleEvent(event: OrganizerWebhookEvent) {
    setEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event],
    );
  }

  function save(extra?: { rotate_secret?: boolean }) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/organizer/webhooks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: url.trim() || null,
          webhook_enabled: enabled,
          webhook_events: events.length > 0 ? events : ["sale.completed"],
          rotate_secret: extra?.rotate_secret ?? false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setMessage(extra?.rotate_secret ? "Secret regenerado e configuração salva." : "Webhook salvo.");
      await load();
    });
  }

  function sendTest() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/organizer/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha no ping de teste");
        await load();
        return;
      }
      setMessage("Ping enviado com sucesso (HTTP 2xx).");
      await load();
    });
  }

  if (!config) {
    return <p className="text-sm text-white/55">{error ?? "Carregando configuração…"}</p>;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">URL do endpoint</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://sua-api.com/webhooks/ticketfly"
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            />
            <span className="text-xs text-white/45">HTTPS obrigatório (localhost liberado em dev).</span>
          </label>

          <label className="flex items-center gap-3 text-sm font-bold text-white/80">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 accent-[#ff1493]"
            />
            Webhook ativo
          </label>

          <div>
            <p className="mb-2 text-sm font-bold text-white/70">Eventos assinados</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ORGANIZER_WEBHOOK_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="size-4 accent-[#ff1493]"
                  />
                  {EVENT_LABELS[event]}
                  <code className="text-[11px] text-white/35">{event}</code>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-white/45">Signing secret</p>
            <p className="mt-2 break-all font-mono text-sm text-[#ff7ec8]">
              {config.webhook_secret
                ? secretVisible
                  ? config.webhook_secret
                  : "••••••••••••••••••••••••••••••••"
                : "Será gerado ao salvar"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {config.webhook_secret ? (
                <button
                  type="button"
                  onClick={() => setSecretVisible((v) => !v)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white/70"
                >
                  {secretVisible ? "Ocultar" : "Mostrar"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => save({ rotate_secret: true })}
                className="rounded-full border border-amber-400/30 px-3 py-1.5 text-xs font-bold text-amber-100"
              >
                Regenerar secret
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => save()}
              className="rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              type="button"
              disabled={pending || !config.webhook_url}
              onClick={sendTest}
              className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-white/80 disabled:opacity-50"
            >
              Enviar ping de teste
            </button>
          </div>

          {message ? (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#120410] p-5">
        <h3 className="text-lg font-black">Últimas entregas</h3>
        <p className="mt-1 text-sm text-white/45">Histórico das notificações enviadas ao seu endpoint.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-white/40">
              <tr>
                <th className="px-2 py-2">Quando</th>
                <th className="px-2 py-2">Evento</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">HTTP</th>
                <th className="px-2 py-2">Tentativas</th>
              </tr>
            </thead>
            <tbody>
              {(config.deliveries ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-white/45">
                    Nenhuma entrega ainda.
                  </td>
                </tr>
              ) : (
                config.deliveries.map((row) => (
                  <tr key={row.id} className="border-t border-white/5 text-white/75">
                    <td className="px-2 py-2 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{row.event_type}</td>
                    <td className="px-2 py-2 capitalize">{row.status}</td>
                    <td className="px-2 py-2">{row.response_status ?? "—"}</td>
                    <td className="px-2 py-2">
                      {row.attempts}
                      {row.last_error ? (
                        <span className="ml-2 text-xs text-amber-200/80">{row.last_error}</span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#120410] p-5 text-sm text-[#c9aabc]">
        <h3 className="text-lg font-black text-white">Como validar a assinatura</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            Leia os headers <code className="text-white/80">X-TicketFly-Timestamp</code> e{" "}
            <code className="text-white/80">X-TicketFly-Signature</code>.
          </li>
          <li>
            Calcule{" "}
            <code className="text-white/80">HMAC-SHA256(secret, timestamp + &quot;.&quot; + rawBody)</code> em hex.
          </li>
          <li>Compare com o signature recebido (timing-safe).</li>
          <li>
            Payload JSON: <code className="text-white/80">{"{ id, type, created_at, data }"}</code>.
          </li>
        </ol>
      </div>
    </div>
  );
}
