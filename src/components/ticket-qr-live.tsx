"use client";

import Image from "next/image";
import { Keyboard, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { formatDateTime } from "@/lib/format";

type QrSession = {
  dataUrl: string;
  expiresAt: string;
  manualCode: string | null;
  buyerName: string | null;
};

type TicketQrLiveProps = {
  code: string;
  accessToken?: string | null;
  initialStatus: string;
  buyerName?: string | null;
};

export function TicketQrLive({ code, accessToken, initialStatus, buyerName }: TicketQrLiveProps) {
  const [session, setSession] = useState<QrSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = accessToken ? `?access=${encodeURIComponent(accessToken)}` : "";
      const response = await fetch(`/api/tickets/${code}/qr-session${qs}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        setSession(null);
        setError(payload.message ?? payload.error ?? "QR Code indisponível");
        setLoading(false);
        return;
      }

      setError(null);
      setSession({
        dataUrl: payload.dataUrl,
        expiresAt: payload.expiresAt,
        manualCode: payload.manualCode ?? null,
        buyerName: payload.buyerName ?? buyerName ?? null,
      });
      setLoading(false);
    } catch {
      setSession(null);
      setError("Não foi possível gerar o QR Code");
      setLoading(false);
    }
  }, [accessToken, buyerName, code]);

  useEffect(() => {
    if (initialStatus !== "paid") {
      setLoading(false);
      setError(
        initialStatus === "used"
          ? "Ingresso já utilizado"
          : initialStatus === "cancelled"
            ? "Ingresso cancelado"
            : "QR disponível após confirmação do pagamento",
      );
      return;
    }

    void load();
  }, [initialStatus, load]);

  if (error && !session) {
    return (
      <div className="grid gap-3">
        <div className="rounded-md border border-[#f5a524]/50 bg-[#261802] p-4 text-sm font-medium text-[#ffd27a]">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Tentar novamente
        </button>
      </div>
    );
  }

  const name = session?.buyerName || buyerName;

  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-[#ff1493]/35 bg-[#210018] px-4 py-4 text-center">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#ffb1d5]">
          <Keyboard className="h-3.5 w-3.5" aria-hidden />
          Código da porta
        </p>
        <p className="mt-1 font-mono text-4xl font-black tracking-[0.18em] text-white">
          {session?.manualCode ?? (loading ? "····" : "—")}
        </p>
        {name ? <p className="mt-2 text-sm font-bold text-white">{name}</p> : null}
        <p className="mt-1 text-[11px] text-[#c9aabc]">
          {session?.expiresAt
            ? `Diga este código ou mostre o QR · válido até ${formatDateTime(session.expiresAt)} · um uso`
            : "Diga este código ou mostre o QR · um uso"}
        </p>
      </div>

      <div className="relative mx-auto">
        {session?.dataUrl ? (
          <Image
            unoptimized
            className="h-72 w-72 rounded-md bg-white p-3"
            src={session.dataUrl}
            alt="QR Code do ingresso"
            width={288}
            height={288}
            priority
          />
        ) : (
          <div className="grid h-72 w-72 place-items-center rounded-md bg-white/95 text-sm text-black/60">
            {loading ? "Gerando código…" : "—"}
          </div>
        )}
      </div>
    </div>
  );
}
