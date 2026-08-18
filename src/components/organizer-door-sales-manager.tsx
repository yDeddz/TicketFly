"use client";

import {
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  QrCode,
  Ticket,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { AlertBanner } from "@/components/ui/alert-banner";
import { readApiError } from "@/lib/client-errors";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { doorSaleSchema, normalizeBrazilianPhone } from "@/lib/validators";

export type DoorSaleEvent = {
  id: string;
  title: string;
  startsAt: string;
  batches: Array<{
    id: string;
    name: string;
    priceCents: number;
    quantityTotal: number;
    quantitySold: number;
    quantityReserved: number;
  }>;
};

type SaleResult = {
  paymentId: string;
  status: string;
  amountCents: number;
  eventTitle: string;
  batchName: string;
  buyerUrl: string;
  checkoutUrl: string | null;
  pix: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  } | null;
  ticketHref?: string | null;
};

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function OrganizerDoorSalesManager({ events }: { events: DoorSaleEvent[] }) {
  const firstEvent = events[0];
  const [eventId, setEventId] = useState(firstEvent?.id ?? "");
  const selectedEvent = events.find((event) => event.id === eventId) ?? firstEvent;
  const [batchId, setBatchId] = useState(selectedEvent?.batches[0]?.id ?? "");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerCpf, setBuyerCpf] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [sale, setSale] = useState<SaleResult | null>(null);

  const selectedBatch = selectedEvent?.batches.find((batch) => batch.id === batchId);
  const available = selectedBatch
    ? Math.max(
        selectedBatch.quantityTotal -
          selectedBatch.quantitySold -
          selectedBatch.quantityReserved,
        0,
      )
    : 0;

  const paymentId = sale?.paymentId;
  const refreshSale = useCallback(async () => {
    if (!paymentId) return;
    try {
      const response = await fetch(`/api/organizer/door-sales/${paymentId}`, {
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (response.ok) {
        setSale((current) => (current ? { ...current, ...body } : current));
      }
    } catch {
      // Keep the current actionable payment screen and retry on the next interval.
    }
  }, [paymentId]);

  useEffect(() => {
    if (sale?.status !== "pending") return;
    const timer = window.setInterval(() => void refreshSale(), 4_000);
    return () => window.clearInterval(timer);
  }, [refreshSale, sale?.status]);

  const summary = useMemo(
    () =>
      selectedBatch
        ? `${selectedEvent?.title ?? "Evento"} · ${selectedBatch.name} · ${formatCurrency(selectedBatch.priceCents)} + taxa`
        : "",
    [selectedBatch, selectedEvent],
  );

  function reviewSale(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = doorSaleSchema.safeParse({
      eventId,
      batchId,
      buyerName,
      buyerEmail,
      buyerCpf,
      buyerPhone,
      paymentMethod,
      idempotencyKey,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados do comprador");
      return;
    }
    if (available <= 0) {
      setError("Este lote não tem mais ingressos disponíveis");
      return;
    }
    setConfirmOpen(true);
  }

  async function createSale() {
    setConfirmOpen(false);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/organizer/door-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          batchId,
          buyerName,
          buyerEmail,
          buyerCpf,
          buyerPhone,
          paymentMethod,
          idempotencyKey,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const apiError = await readApiError(
          new Response(JSON.stringify(body), {
            status: response.status,
            headers: response.headers,
          }),
          "Não foi possível criar a transação",
        );
        setError(apiError.message);
        if (response.status === 422 || response.status === 409) {
          setIdempotencyKey(crypto.randomUUID());
        }
        return;
      }
      setSale(body);
      setBuyerCpf("");
    } catch {
      setError("Falha de rede. Tente novamente; a mesma venda não será duplicada.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 2_000);
  }

  function shareOnWhatsApp(url: string, kind: "payment" | "ticket") {
    const phone = normalizeBrazilianPhone(buyerPhone);
    const target = phone ? `55${phone}` : "";
    const text =
      kind === "payment"
        ? `Olá, ${buyerName}! Finalize o pagamento do ingresso para ${sale?.eventTitle}: ${url}`
        : `Olá, ${buyerName}! Seu pagamento foi aprovado. Acesse seu ingresso: ${url}`;
    window.open(
      `https://wa.me/${target}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function startAnotherSale() {
    setSale(null);
    setBuyerName("");
    setBuyerEmail("");
    setBuyerCpf("");
    setBuyerPhone("");
    setPaymentMethod("pix");
    setIdempotencyKey(crypto.randomUUID());
    setError("");
  }

  if (!events.length) {
    return (
      <AlertBanner tone="warning">
        Você precisa ter um evento publicado com lote ativo para vender na porta.
      </AlertBanner>
    );
  }

  if (sale) {
    const qrImage = sale.pix?.encodedImage
      ? sale.pix.encodedImage.startsWith("data:")
        ? sale.pix.encodedImage
        : `data:image/png;base64,${sale.pix.encodedImage}`
      : null;

    return (
      <div className="grid gap-5">
        <div className="rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#ff1493]">
                Transação criada
              </p>
              <h2 className="mt-2 text-2xl font-black">{sale.eventTitle}</h2>
              <p className="mt-1 text-sm text-white/55">
                {sale.batchName} · {formatCurrency(sale.amountCents)}
              </p>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold uppercase">
              {sale.status === "approved" ? "Aprovado" : "Aguardando pagamento"}
            </span>
          </div>

          {sale.status === "approved" ? (
            <div className="mt-6 grid gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/8 p-5 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" />
              <h3 className="text-2xl font-black text-emerald-100">Pagamento aprovado</h3>
              <p className="text-sm text-white/60">O ingresso já pode ser apresentado na entrada.</p>
              {sale.ticketHref ? (
                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  <a
                    href={sale.ticketHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#ff1493] px-4 text-sm font-bold text-white"
                  >
                    <Ticket className="h-4 w-4" /> Abrir ingresso
                  </a>
                  <button
                    type="button"
                    onClick={() => shareOnWhatsApp(sale.ticketHref!, "ticket")}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-emerald-400/30 px-4 text-sm font-bold text-emerald-100"
                  >
                    <MessageCircle className="h-4 w-4" /> Enviar ingresso no WhatsApp
                  </button>
                </div>
              ) : null}
            </div>
          ) : sale.status !== "pending" ? (
            <div className="mt-6">
              <AlertBanner tone="error">
                Esta cobrança foi encerrada ({sale.status}). Inicie uma nova venda para tentar
                novamente.
              </AlertBanner>
            </div>
          ) : paymentMethod === "pix" ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-[300px_1fr] lg:items-center">
              {qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImage}
                  alt="QR Code PIX"
                  className="mx-auto w-full max-w-[300px] rounded-2xl bg-white p-3"
                />
              ) : (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-white/10">
                  <Loader2 className="h-8 w-8 animate-spin text-[#ff1493]" />
                </div>
              )}
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <QrCode className="h-5 w-5 text-[#ff1493]" /> PIX pronto
                </h3>
                <p className="mt-2 text-sm text-white/55">
                  O comprador pode escanear agora ou receber a página de pagamento no celular.
                </p>
                <div className="mt-4 grid gap-2">
                  {sale.pix?.payload ? (
                    <button
                      type="button"
                      onClick={() => void copy(sale.pix!.payload, "pix")}
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold"
                    >
                      <Copy className="h-4 w-4" />
                      {copied === "pix" ? "PIX copiado" : "Copiar PIX"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => shareOnWhatsApp(sale.buyerUrl, "payment")}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-bold text-white"
                  >
                    <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void copy(sale.buyerUrl, "link")}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold"
                  >
                    <Copy className="h-4 w-4" />
                    {copied === "link" ? "Link copiado" : "Copiar link"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 p-5 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-[#ff7ec8]" />
              <h3 className="text-xl font-black">Link de cartão pronto</h3>
              <p className="text-sm text-white/55">
                Envie ao comprador. Os dados do cartão são preenchidos somente no Asaas.
              </p>
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => shareOnWhatsApp(sale.buyerUrl, "payment")}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-bold text-white"
                >
                  <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
                </button>
                <a
                  href={sale.checkoutUrl ?? sale.buyerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold"
                >
                  <ExternalLink className="h-4 w-4" /> Abrir pagamento
                </a>
                <button
                  type="button"
                  onClick={() => void copy(sale.buyerUrl, "link")}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold"
                >
                  <Copy className="h-4 w-4" />
                  {copied === "link" ? "Link copiado" : "Copiar link"}
                </button>
              </div>
            </div>
          )}

          {sale.status === "pending" ? (
            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-white/45">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Aguardando webhook e atualizando automaticamente…
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={startAnotherSale}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm font-bold"
        >
          <Plus className="h-4 w-4" /> Nova venda
        </button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={reviewSale} className="grid gap-6">
        {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

        <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#120410] p-4 sm:p-5">
          <h3 className="text-lg font-black">1. Evento</h3>
          <select
            value={eventId}
            onChange={(event) => {
              const nextId = event.target.value;
              setEventId(nextId);
              setBatchId(events.find((item) => item.id === nextId)?.batches[0]?.id ?? "");
            }}
            className="h-12 rounded-xl border border-white/12 bg-[#0d0b10] px-3"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} · {formatDateTime(event.startsAt)}
              </option>
            ))}
          </select>
        </section>

        <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#120410] p-4 sm:p-5">
          <h3 className="text-lg font-black">2. Tipo de ingresso</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {(selectedEvent?.batches ?? []).map((batch) => {
              const batchAvailable = Math.max(
                batch.quantityTotal - batch.quantitySold - batch.quantityReserved,
                0,
              );
              const active = batch.id === batchId;
              return (
                <button
                  key={batch.id}
                  type="button"
                  disabled={batchAvailable === 0}
                  onClick={() => setBatchId(batch.id)}
                  aria-pressed={active}
                  className={`cursor-pointer rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    active
                      ? "border-[#ff1493]/60 bg-[#ff1493]/12"
                      : "border-white/10 bg-black/15 hover:border-white/25"
                  }`}
                >
                  <strong className="block">{batch.name}</strong>
                  <span className="mt-1 block text-lg font-black text-[#ff7ec8]">
                    {formatCurrency(batch.priceCents)}
                  </span>
                  <span className="mt-1 block text-xs text-white/45">
                    {batchAvailable} disponível(is)
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-white/10 bg-[#120410] p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-black">3. Dados do comprador</h3>
            <p className="mt-1 text-xs text-white/45">
              O CPF vai somente para o Asaas e não fica salvo na TicketFly.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm sm:col-span-2">
              Nome completo
              <input
                required
                autoComplete="name"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
                className="h-12 rounded-xl border border-white/12 bg-[#0d0b10] px-3"
              />
            </label>
            <label className="grid gap-2 text-sm">
              CPF
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                value={buyerCpf}
                onChange={(event) => setBuyerCpf(maskCpf(event.target.value))}
                placeholder="000.000.000-00"
                className="h-12 rounded-xl border border-white/12 bg-[#0d0b10] px-3"
              />
            </label>
            <label className="grid gap-2 text-sm">
              Celular com DDD
              <input
                required
                inputMode="tel"
                autoComplete="tel"
                value={buyerPhone}
                onChange={(event) => setBuyerPhone(maskPhone(event.target.value))}
                placeholder="(11) 99999-9999"
                className="h-12 rounded-xl border border-white/12 bg-[#0d0b10] px-3"
              />
            </label>
            <label className="grid gap-2 text-sm sm:col-span-2">
              E-mail
              <input
                required
                type="email"
                autoComplete="email"
                value={buyerEmail}
                onChange={(event) => setBuyerEmail(event.target.value)}
                className="h-12 rounded-xl border border-white/12 bg-[#0d0b10] px-3"
              />
            </label>
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#120410] p-4 sm:p-5">
          <h3 className="text-lg font-black">4. Forma de pagamento</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={paymentMethod === "pix"}
              onClick={() => setPaymentMethod("pix")}
              className={`inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border font-bold ${
                paymentMethod === "pix"
                  ? "border-[#ff1493]/60 bg-[#ff1493]/12"
                  : "border-white/10"
              }`}
            >
              <QrCode className="h-5 w-5" /> PIX
            </button>
            <button
              type="button"
              aria-pressed={paymentMethod === "credit_card"}
              onClick={() => setPaymentMethod("credit_card")}
              className={`inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border font-bold ${
                paymentMethod === "credit_card"
                  ? "border-[#ff1493]/60 bg-[#ff1493]/12"
                  : "border-white/10"
              }`}
            >
              <CreditCard className="h-5 w-5" /> Cartão
            </button>
          </div>
        </section>

        <button
          type="submit"
          disabled={loading || !selectedBatch || available <= 0}
          className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#ff1493] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Ticket className="h-5 w-5" />}
          Revisar e criar transação
        </button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Criar esta transação?"
        description={`${summary}. O ingresso ficará reservado por até 30 minutos aguardando pagamento.`}
        confirmLabel="Criar transação"
        tone="primary"
        busy={loading}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void createSale()}
      />
    </>
  );
}

