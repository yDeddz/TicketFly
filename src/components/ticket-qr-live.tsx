"use client";

import Image from "next/image";
import { Keyboard, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type QrSession = {
  dataUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
  refreshAfterSeconds: number;
  status: string;
  manualCode: string | null;
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
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiresAtRef = useRef<number>(0);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshRef.current) clearTimeout(refreshRef.current);
    timerRef.current = null;
    refreshRef.current = null;
  };

  const scheduleRetry = useCallback((delayMs: number, fn: () => void) => {
    clearTimers();
    refreshRef.current = setTimeout(fn, delayMs);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = accessToken ? `?access=${encodeURIComponent(accessToken)}` : "";
      const response = await fetch(`/api/tickets/${code}/qr-session${qs}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        const message = payload.message ?? payload.error ?? "QR indisponível";
        const stillValid = expiresAtRef.current > Date.now();
        if (stillValid) {
          setRefreshWarning(`${message}. Mantendo o QR atual até expirar.`);
          setLoading(false);
          scheduleRetry(8_000, () => {
            void load();
          });
          return;
        }
        setSession(null);
        setError(message);
        setLoading(false);
        return;
      }

      setError(null);
      setRefreshWarning(null);
      setSession({
        dataUrl: payload.dataUrl,
        expiresAt: payload.expiresAt,
        expiresInSeconds: payload.expiresInSeconds,
        refreshAfterSeconds: payload.refreshAfterSeconds,
        status: payload.status,
        manualCode: payload.manualCode ?? null,
      });
      expiresAtRef.current = new Date(payload.expiresAt).getTime();
      setSecondsLeft(payload.expiresInSeconds);
      setLoading(false);

      clearTimers();
      timerRef.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
        setSecondsLeft(left);
        if (left === 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          void load();
        }
      }, 1000);

      refreshRef.current = setTimeout(() => {
        void load();
      }, Math.max(15_000, payload.refreshAfterSeconds * 1000));
    } catch {
      const stillValid = expiresAtRef.current > Date.now();
      if (stillValid) {
        setRefreshWarning("Falha de rede ao renovar. Mantendo o QR atual — tentando de novo…");
        setLoading(false);
        scheduleRetry(5_000, () => {
          void load();
        });
        return;
      }
      setSession(null);
      setError("Falha ao gerar sessão do QR");
      setLoading(false);
      scheduleRetry(5_000, () => {
        void load();
      });
    }
  }, [accessToken, code, scheduleRetry]);

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

      {refreshWarning ? (
        <p className="rounded-md border border-[#f5a524]/40 bg-[#261802] px-3 py-2 text-center text-xs text-[#ffd27a]">
          {refreshWarning}
        </p>
      ) : null}

      {session?.manualCode ? (
        <div className="rounded-md border border-[#ff1493]/35 bg-[#210018] px-4 py-3 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#ffb1d5]">
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            Código da porta (se a câmera falhar)
          </p>
          <p className="mt-1 font-mono text-3xl font-black tracking-[0.18em] text-white">
            {session.manualCode}
          </p>
          <p className="mt-1 text-[11px] text-[#c9aabc]">
            Diga este código ao operador · expira com o QR ({secondsLeft}s)
          </p>
        </div>
      ) : null}

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
        Este QR e o código da porta rotacionam juntos. Na Wallet, use o pass salvo — ele permanece
        válido até o fim do evento.
      </p>
    </div>
  );
}
