"use client";

import Image from "next/image";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type QrSession = {
  dataUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
  refreshAfterSeconds: number;
  status: string;
};

type TicketQrLiveProps = {
  code: string;
  accessToken?: string | null;
  initialStatus: string;
};

export function TicketQrLive({ code, accessToken, initialStatus }: TicketQrLiveProps) {
  const [session, setSession] = useState<QrSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshRef.current) clearTimeout(refreshRef.current);
    timerRef.current = null;
    refreshRef.current = null;
  };

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
        setError(payload.message ?? payload.error ?? "QR indisponível");
        setLoading(false);
        return;
      }

      setError(null);
      setSession(payload);
      setSecondsLeft(payload.expiresInSeconds);
      setLoading(false);

      clearTimers();
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);

      refreshRef.current = setTimeout(() => {
        void load();
      }, Math.max(15_000, payload.refreshAfterSeconds * 1000));
    } catch {
      setError("Falha ao gerar sessão do QR");
      setLoading(false);
    }
  }, [accessToken, code]);

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
    return () => clearTimers();
  }, [initialStatus, load]);

  if (error && !session) {
    return (
      <div className="rounded-md border border-[#f5a524]/50 bg-[#261802] p-4 text-sm font-medium text-[#ffd27a]">
        {error}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="relative mx-auto">
        {session?.dataUrl ? (
          <Image
            unoptimized
            className="h-72 w-72 rounded-md bg-white p-3"
            src={session.dataUrl}
            alt="QR Code dinâmico do ingresso"
            width={288}
            height={288}
            priority
          />
        ) : (
          <div className="grid h-72 w-72 place-items-center rounded-md bg-white/95 text-sm text-black/60">
            {loading ? "Gerando QR…" : "—"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[#ffb1d5]">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Sessão assinada · {secondsLeft}s
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 text-white/80 hover:bg-white/5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Atualizar
        </button>
      </div>
      <p className="text-center text-xs text-[#c9aabc]">
        Este QR rotaciona automaticamente. Na Wallet, use o pass salvo — ele permanece válido até o fim do evento.
      </p>
    </div>
  );
}
