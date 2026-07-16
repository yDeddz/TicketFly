"use client";

import { BadgeCheck, CreditCard, Loader2, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { formatCurrency } from "@/lib/format";
import type { TicketBatch } from "@/types/domain";

export function CheckoutForm({ batches, demoMode = false }: { batches: TicketBatch[]; demoMode?: boolean }) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [promoterCode, setPromoterCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedBatch = batches.find((batch) => batch.id === batchId);
  const total = selectedBatch ? selectedBatch.price_cents : 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (demoMode) {
      window.setTimeout(() => {
        setLoading(false);
        setMessage("Checkout visual pronto. Conecte o Supabase e Mercado Pago para processar compras reais.");
      }, 700);
      return;
    }

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchId, buyerName, buyerEmail, promoterCode }),
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel iniciar a compra");
      return;
    }

    window.location.href = payload.checkoutUrl;
  }

  return (
    <form onSubmit={submit} className="glass-panel grid gap-5 rounded-lg p-5">
      <div>
        <p className="text-xs font-black uppercase text-[#ff1493]">Checkout seguro</p>
        <h2 className="mt-1 text-2xl font-black">Finalizar compra</h2>
        <p className="mt-2 text-sm text-white/56">Pix, cartao e aprovacao com ingresso digital.</p>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Lote
        <select
          value={batchId}
          onChange={(event) => setBatchId(event.target.value)}
          className="h-12 rounded-lg border border-white/10 bg-[#0d0b10] px-3 outline-none transition focus:border-[#ff1493]/70"
        >
          {batches.map((batch) => {
            const available = batch.quantity_total - batch.quantity_reserved - batch.quantity_sold;
            return (
              <option key={batch.id} value={batch.id}>
                {batch.name} - {formatCurrency(batch.price_cents)} - {available} disp.
              </option>
            );
          })}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Nome
          <input
            required
            value={buyerName}
            onChange={(event) => setBuyerName(event.target.value)}
            className="h-12 rounded-lg border border-white/10 px-3 outline-none transition focus:border-[#ff1493]/70"
            placeholder="Seu nome"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          E-mail
          <input
            required
            type="email"
            value={buyerEmail}
            onChange={(event) => setBuyerEmail(event.target.value)}
            className="h-12 rounded-lg border border-white/10 px-3 outline-none transition focus:border-[#ff1493]/70"
            placeholder="voce@email.com"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Codigo do promoter
        <input
          value={promoterCode}
          onChange={(event) => setPromoterCode(event.target.value)}
          className="h-12 rounded-lg border border-white/10 px-3 outline-none transition focus:border-[#ff1493]/70"
          placeholder="Opcional"
        />
      </label>

      {selectedBatch ? (
        <div className="grid gap-3 rounded-lg border border-white/10 bg-black/30 p-4 text-sm">
          <div className="flex items-center justify-between text-white/62">
            <span>{selectedBatch.name}</span>
            <strong className="text-white">{formatCurrency(selectedBatch.price_cents)}</strong>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span>Total</span>
            <strong className="text-2xl text-white">{formatCurrency(total)}</strong>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-[#ff6aa9]">{error}</p> : null}
      {message ? <p className="rounded-lg border border-[#ff1493]/25 bg-[#ff1493]/10 p-3 text-sm text-[#ffb1d5]">{message}</p> : null}

      <button
        disabled={!batchId || loading}
        className="neon-button flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-4 py-4 font-black disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Finalizar Pedido
      </button>

      <div className="grid gap-2 text-xs text-white/50">
        <span className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-[#ff1493]" />
          Pagamento criptografado e ambiente protegido.
        </span>
        <span className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-[#ff1493]" />
          QR Code liberado apos aprovacao.
        </span>
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#ff1493]" />
          Ingresso unico com bloqueio de duplicidade.
        </span>
        <span className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-[#ff1493]" />
          Compra confirmada por e-mail.
        </span>
      </div>
    </form>
  );
}
