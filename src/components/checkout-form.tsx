"use client";

import { ArrowRight, BadgeCheck, Loader2, LockKeyhole, QrCode, ShieldCheck, ShieldPlus, Ticket } from "lucide-react";
import { useMemo, useState } from "react";

import {
  computePurchaseInsurance,
  computeServiceFee,
  DEFAULT_FEE_CONTRACT,
  type FeeContract,
} from "@/lib/fees";
import { formatCurrency } from "@/lib/format";
import type { TicketBatch } from "@/types/domain";

const INSURANCE_COVERAGES = [
  "Doença / COVID-19",
  "Acidente pessoal",
  "Furto de documentos",
  "Falha no transporte público",
  "Óbito de familiar",
  "Compromisso profissional / judicial",
];

export function CheckoutForm({
  batches,
  demoMode = false,
  feeContract = DEFAULT_FEE_CONTRACT,
}: {
  batches: TicketBatch[];
  demoMode?: boolean;
  feeContract?: FeeContract;
}) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [insuranceSelected, setInsuranceSelected] = useState(true);
  const [showCoverages, setShowCoverages] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedBatch = batches.find((batch) => batch.id === batchId);
  const fee = selectedBatch ? computeServiceFee(selectedBatch.price_cents, feeContract) : null;
  const insuranceCents = selectedBatch
    ? computePurchaseInsurance(selectedBatch.price_cents, feeContract.fee_threshold_cents)
    : 0;

  const totalCents = useMemo(() => {
    if (!selectedBatch || !fee) return 0;
    return selectedBatch.price_cents + fee.feeCents + (insuranceSelected ? insuranceCents : 0);
  }, [selectedBatch, fee, insuranceSelected, insuranceCents]);

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
      body: JSON.stringify({
        batchId,
        insuranceSelected,
      }),
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
        <h2 className="mt-1 text-2xl font-black">Escolha seu ingresso</h2>
        <p className="mt-2 text-sm text-white/56">
          Selecione o tipo, proteja a compra e continue no Mercado Pago.
        </p>
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-medium">Tipos de ingresso</p>
        {batches.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/55">
            Nenhum ingresso disponível no momento.
          </p>
        ) : (
          batches.map((batch) => {
            const available = batch.quantity_total - batch.quantity_reserved - batch.quantity_sold;
            const soldOut = available <= 0;
            const selected = batchId === batch.id;

            return (
              <button
                key={batch.id}
                type="button"
                disabled={soldOut}
                onClick={() => setBatchId(batch.id)}
                className={`grid gap-1 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? "border-[#ff1493]/70 bg-[#ff1493]/12"
                    : "border-white/10 bg-black/20 hover:border-white/25"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Ticket className={`h-4 w-4 ${selected ? "text-[#ff1493]" : "text-white/45"}`} />
                    {batch.name}
                  </span>
                  <strong className="text-base text-white">{formatCurrency(batch.price_cents)}</strong>
                </span>
                <span className="text-xs text-white/45">
                  {soldOut ? "Esgotado" : `${available} disponíveis`}
                  {batch.description ? ` · ${batch.description}` : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      {selectedBatch && fee ? (
        <div className="grid gap-3">
          <div>
            <h3 className="text-lg font-black">Proteja-se de imprevistos!</h3>
            <p className="mt-1 text-sm text-white/50">
              Seguro de compra opcional — reembolso em casos cobertos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setInsuranceSelected(true)}
            className={`relative grid gap-2 rounded-xl border p-4 text-left transition ${
              insuranceSelected
                ? "border-[#ff1493]/70 bg-[#ff1493]/12"
                : "border-white/10 bg-black/20 hover:border-white/25"
            }`}
          >
            <span className="absolute right-3 top-3 rounded-full bg-[#ff1493] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
              Recomendado
            </span>
            <span className="flex items-center gap-2 pr-20 text-sm font-bold">
              <ShieldPlus className="h-4 w-4 text-[#ff1493]" />
              Proteção de compra — {formatCurrency(insuranceCents)}
            </span>
            {showCoverages ? (
              <ul className="mt-1 grid gap-1 text-xs text-white/55 sm:grid-cols-2">
                {INSURANCE_COVERAGES.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setShowCoverages((v) => !v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  setShowCoverages((v) => !v);
                }
              }}
              className="mt-1 cursor-pointer text-xs font-semibold text-[#ff7ec8] underline-offset-2 hover:underline"
            >
              {showCoverages ? "Esconder coberturas" : "Ver coberturas"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setInsuranceSelected(false)}
            className={`grid gap-1 rounded-xl border p-4 text-left transition ${
              !insuranceSelected
                ? "border-white/40 bg-white/5"
                : "border-white/10 bg-black/20 hover:border-white/25"
            }`}
          >
            <span className="text-sm font-bold">Seguir sem proteção adicional</span>
            <span className="text-xs text-white/45">
              Tenho certeza que vou ao evento — imprevistos acontecem.
            </span>
          </button>

          <div className="grid gap-3 rounded-lg border border-white/10 bg-black/30 p-4 text-sm">
            <div className="flex items-center justify-between text-white/62">
              <span>{selectedBatch.name}</span>
              <strong className="text-white">{formatCurrency(selectedBatch.price_cents)}</strong>
            </div>
            {insuranceSelected ? (
              <div className="flex items-center justify-between text-white/62">
                <span>Proteção de compra</span>
                <strong className="text-white">{formatCurrency(insuranceCents)}</strong>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-white/62">
              <span>Taxa de serviço ({fee.feePercent}%)</span>
              <strong className="text-white">{formatCurrency(fee.feeCents)}</strong>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span>Total</span>
              <strong className="text-2xl text-white">{formatCurrency(totalCents)}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-[#ff6aa9]">{error}</p> : null}
      {message ? (
        <p className="rounded-lg border border-[#ff1493]/25 bg-[#ff1493]/10 p-3 text-sm text-[#ffb1d5]">
          {message}
        </p>
      ) : null}

      <button
        disabled={!batchId || loading}
        className="neon-button flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-4 py-4 font-black disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Continuar para pagamento
      </button>

      <div className="grid gap-2 text-xs text-white/50">
        <span className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-[#ff1493]" />
          Dados e pagamento no checkout seguro do Mercado Pago.
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
