"use client";

import { ArrowRight, BadgeCheck, Loader2, LockKeyhole, QrCode, ShieldCheck, ShieldPlus, Ticket } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  computePurchaseInsurance,
  computeServiceFee,
  DEFAULT_FEE_CONTRACT,
  type FeeContract,
} from "@/lib/fees";
import { formatCurrency } from "@/lib/format";
import type { PaymentProviderName } from "@/lib/payments/types";
import { checkoutSchema } from "@/lib/validators";
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
  initialPromoterCode = "",
  initialCouponCode = "",
  initialBuyerName = "",
  initialBuyerEmail = "",
  paymentProvider = "mercado_pago",
}: {
  batches: TicketBatch[];
  demoMode?: boolean;
  feeContract?: FeeContract;
  initialPromoterCode?: string;
  initialCouponCode?: string;
  initialBuyerName?: string;
  initialBuyerEmail?: string;
  paymentProvider?: PaymentProviderName;
}) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [buyerName, setBuyerName] = useState(initialBuyerName);
  const [buyerEmail, setBuyerEmail] = useState(initialBuyerEmail);
  const [insuranceSelected, setInsuranceSelected] = useState(false);
  const [showCoverages, setShowCoverages] = useState(false);
  const [couponCode, setCouponCode] = useState(initialCouponCode.toUpperCase());
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountCents: number;
  } | null>(null);
  const [promoterCode] = useState(initialPromoterCode);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const autoCouponRef = useRef(false);
  const providerHint = paymentProvider === "asaas" ? "Pix ou cartão" : "checkout seguro";

  const selectedBatch = batches.find((batch) => batch.id === batchId);
  const discountCents = appliedCoupon?.discountCents ?? 0;
  const ticketPriceCents = Math.max(0, (selectedBatch?.price_cents ?? 0) - discountCents);
  const fee = selectedBatch ? computeServiceFee(ticketPriceCents, feeContract) : null;
  const insuranceCents = selectedBatch
    ? computePurchaseInsurance(ticketPriceCents, feeContract.fee_threshold_cents)
    : 0;

  const totalCents = useMemo(() => {
    if (!selectedBatch || !fee) return 0;
    return ticketPriceCents + fee.feeCents + (insuranceSelected ? insuranceCents : 0);
  }, [selectedBatch, fee, insuranceSelected, insuranceCents, ticketPriceCents]);

  async function applyCoupon() {
    setError("");
    setMessage("");
    if (!batchId || !couponCode.trim()) {
      setError("Informe o cupom");
      return;
    }
    if (demoMode) {
      setAppliedCoupon({ code: couponCode.trim().toUpperCase(), discountCents: 0 });
      setMessage("Modo demo: cupom será validado com a API conectada.");
      return;
    }
    setCouponLoading(true);
    try {
      const response = await fetch(
        `/api/checkout/coupon?batchId=${encodeURIComponent(batchId)}&code=${encodeURIComponent(couponCode.trim())}`,
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setAppliedCoupon(null);
        setError(payload?.error ?? "Cupom inválido");
        return;
      }
      setAppliedCoupon({ code: payload.code, discountCents: payload.discountCents });
      setCouponCode(payload.code);
      setMessage(`Cupom ${payload.code} aplicado (−${formatCurrency(payload.discountCents)})`);
    } catch {
      setAppliedCoupon(null);
      setError("Falha de rede ao validar cupom");
    } finally {
      setCouponLoading(false);
    }
  }

  useEffect(() => {
    if (autoCouponRef.current || demoMode || !batchId || !couponCode.trim()) return;
    autoCouponRef.current = true;
    void applyCoupon();
    // First paint only: apply ?cupom= when the event page passes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (demoMode) {
      window.setTimeout(() => {
        setLoading(false);
        setMessage("Checkout visual pronto. Use a página do evento para compras reais.");
      }, 700);
      return;
    }

    try {
      const parsed = checkoutSchema.safeParse({
        batchId,
        buyerName,
        buyerEmail,
        insuranceSelected,
        couponCode: appliedCoupon?.code || couponCode.trim() || undefined,
        promoterCode: promoterCode || undefined,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Dados do checkout inválidos");
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Não foi possível iniciar a compra");
        return;
      }

      if (!payload?.checkoutUrl) {
        setError("Checkout criado sem URL de pagamento");
        return;
      }

      window.location.href = payload.checkoutUrl;
    } catch {
      setError("Falha de rede ao iniciar a compra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass-panel grid gap-5 rounded-lg p-5">
      <div>
        <p className="text-xs font-black uppercase text-[#ff1493]">Checkout seguro</p>
        <h2 className="mt-1 text-2xl font-black">Escolha seu ingresso</h2>
        <p className="mt-2 text-sm text-white/56">
          Informe seus dados, escolha o lote e pague com {providerHint}.
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
                onClick={() => {
                  setBatchId(batch.id);
                  setAppliedCoupon(null);
                  setMessage("");
                }}
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

      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Nome completo</span>
          <input
            required
            autoComplete="name"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Como deve aparecer no ingresso"
            className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">E-mail</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="Para acessar o ingresso"
            className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
          />
        </label>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Cupom de desconto</p>
        <div className="flex gap-2">
          <input
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              setAppliedCoupon(null);
            }}
            placeholder="Código"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono uppercase text-white outline-none focus:border-[#ff1493]/50"
          />
          <button
            type="button"
            disabled={couponLoading || !couponCode.trim()}
            onClick={() => void applyCoupon()}
            className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white/80 disabled:opacity-50"
          >
            {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
          </button>
        </div>
      </div>

      {selectedBatch && fee ? (
        <div className="grid gap-3">
          <div>
            <h3 className="text-lg font-black">Proteja-se de imprevistos!</h3>
            <p className="mt-1 text-sm text-white/50">
              Opcional. Reembolso em imprevistos cobertos, conforme regras do evento — não é apólice de seguradora.
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
            {discountCents > 0 ? (
              <div className="flex items-center justify-between text-emerald-200/90">
                <span>Cupom {appliedCoupon?.code}</span>
                <strong>−{formatCurrency(discountCents)}</strong>
              </div>
            ) : null}
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
        disabled={!batchId || loading || !buyerName.trim() || !buyerEmail.trim()}
        className="neon-button flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-4 py-4 font-black disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Continuar para pagamento
      </button>

      <div className="grid gap-2 text-xs text-white/50">
        <span className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-[#ff1493]" />
          Pagamento processado de forma segura ({providerHint}).
        </span>
        <span className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-[#ff1493]" />
          QR Code liberado após a aprovação.
        </span>
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#ff1493]" />
          Ingresso único com bloqueio de duplicidade.
        </span>
        <span className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-[#ff1493]" />
          Guarde a tela de status e o e-mail da compra para abrir o ingresso.
        </span>
      </div>
    </form>
  );
}
