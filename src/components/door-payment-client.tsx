"use client";

import {
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  QrCode,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AlertBanner } from "@/components/ui/alert-banner";
import { formatCurrency } from "@/lib/format";

type DoorPaymentState = {
  paymentId: string;
  status: string;
  amountCents: number;
  paymentMethod: "pix" | "credit_card";
  checkoutUrl: string | null;
  pix: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  } | null;
  ticketHref: string | null;
  ticketStatus: string | null;
  eventTitle: string;
  batchName: string;
};

export function DoorPaymentClient({
  token,
  initial,
}: {
  token: string;
  initial: DoorPaymentState;
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/door-sales/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.message ?? "Não foi possível atualizar o pagamento");
        return;
      }
      setError("");
      setState(body);
    } catch {
      setError("Falha de rede. O status será atualizado quando a conexão voltar.");
    }
  }, [token]);

  useEffect(() => {
    if (state.status !== "pending") return;
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [refresh, state.status]);

  async function copyPix() {
    if (!state.pix?.payload) return;
    await navigator.clipboard.writeText(state.pix.payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  const qrImage = state.pix?.encodedImage
    ? state.pix.encodedImage.startsWith("data:")
      ? state.pix.encodedImage
      : `data:image/png;base64,${state.pix.encodedImage}`
    : null;

  return (
    <div className="grid gap-5 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 shadow-xl shadow-[#ff1493]/5 sm:p-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">
          Bilheteria na Porta
        </p>
        <h1 className="mt-2 text-3xl font-black">{state.eventTitle}</h1>
        <p className="mt-2 text-sm text-white/55">
          {state.batchName} · {formatCurrency(state.amountCents)}
        </p>
      </div>

      {error ? <AlertBanner tone="warning">{error}</AlertBanner> : null}

      {state.status === "approved" ? (
        <div className="grid gap-4 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-300" />
          <div>
            <h2 className="text-2xl font-black text-emerald-200">Pagamento aprovado</h2>
            <p className="mt-2 text-sm text-white/60">Seu ingresso já está liberado.</p>
          </div>
          {state.ticketHref ? (
            <a
              href={state.ticketHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ff1493] px-5 font-bold text-white"
            >
              Abrir meu ingresso
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      ) : state.status !== "pending" ? (
        <AlertBanner tone="error">
          Esta cobrança foi {state.status === "refunded" ? "reembolsada" : "cancelada"}. Procure a
          bilheteria para iniciar uma nova venda.
        </AlertBanner>
      ) : state.paymentMethod === "pix" ? (
        <div className="grid gap-4 text-center">
          <div className="flex items-center justify-center gap-2 text-lg font-black">
            <QrCode className="h-5 w-5 text-[#ff1493]" />
            Pague com PIX
          </div>
          {qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrImage}
              alt="QR Code PIX"
              className="mx-auto w-full max-w-[280px] rounded-2xl bg-white p-3"
            />
          ) : (
            <div className="grid min-h-52 place-items-center rounded-2xl border border-white/10 bg-black/20">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff1493]" />
            </div>
          )}
          {state.pix?.payload ? (
            <button
              type="button"
              onClick={() => void copyPix()}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-5 font-bold text-white"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Código copiado" : "Copiar PIX copia e cola"}
            </button>
          ) : null}
          <p className="flex items-center justify-center gap-2 text-xs text-white/45">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Aguardando confirmação automática…
          </p>
        </div>
      ) : (
        <div className="grid gap-4 text-center">
          <CreditCard className="mx-auto h-14 w-14 text-[#ff7ec8]" />
          <div>
            <h2 className="text-2xl font-black">Pagamento com cartão</h2>
            <p className="mt-2 text-sm text-white/60">
              Os dados do cartão serão preenchidos no ambiente seguro do Asaas.
            </p>
          </div>
          {state.checkoutUrl ? (
            <a
              href={state.checkoutUrl}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ff1493] px-5 font-bold text-white"
            >
              Pagar com cartão
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparando link seguro…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

