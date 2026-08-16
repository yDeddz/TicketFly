"use client";

import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, CheckCircle2, Keyboard, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type CheckinEventOption = {
  id: string;
  title: string;
  startsAt: string;
  status: string;
};

type CheckinResponse = {
  result: "valid" | "already_used" | "cancelled" | "not_found" | "not_paid";
  message: string;
  ticket_id: string | null;
  event_id: string | null;
  reason?: string;
  buyer_name?: string | null;
  event_title?: string | null;
  entry_mode?: "manual" | "scan";
};

type EntryMode = "camera" | "manual";

const resultClass: Record<CheckinResponse["result"], string> = {
  valid: "bg-[#062417] text-[#8fffc1] border-[#25d47a]/50",
  already_used: "bg-[#261802] text-[#ffd27a] border-[#f5a524]/50",
  cancelled: "bg-[#2a050d] text-[#ff9aae] border-[#ff3b6b]/50",
  not_found: "bg-[#140713] text-[#f7bddc] border-[#ff1493]/35",
  not_paid: "bg-[#261802] text-[#ffd27a] border-[#f5a524]/50",
};

const COOLDOWN_MS = 3500;
const STORAGE_KEY = "ticketfly.checkin.eventId";

function formatManualInput(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

function formatEventLabel(event: CheckinEventOption) {
  const when = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
  return `${event.title} · ${when}`;
}

export function CheckinScanner({ events }: { events: CheckinEventOption[] }) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const loadingRef = useRef(false);
  const lastPayloadRef = useRef<string>("");
  const cooldownUntilRef = useRef(0);
  const pendingPayloadRef = useRef<string | null>(null);
  const eventIdRef = useRef<string>("");
  const sessionExpiredRef = useRef(false);

  const [eventId, setEventId] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("camera");
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [cameraHint, setCameraHint] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  useEffect(() => {
    if (!events.length) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const initial = events.some((event) => event.id === stored) ? stored! : events[0]!.id;
    setEventId(initial);
    eventIdRef.current = initial;
  }, [events]);

  useEffect(() => {
    eventIdRef.current = eventId;
    if (eventId && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, eventId);
    }
  }, [eventId]);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;
    setWakeLockActive(false);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setWakeLockActive(true);
      wakeLockRef.current.addEventListener("release", () => {
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.clear();
    } catch {
      // ignore teardown races on iOS
    }
    scannerRef.current = null;
  }, []);

  const validate = useCallback(
    async (qrToken: string) => {
      const trimmed = qrToken.trim();
      if (!trimmed) return;

      if (sessionExpiredRef.current) return;

      const selectedEventId = eventIdRef.current;
      if (!selectedEventId) {
        setResult({
          result: "not_found",
          message: "Selecione o evento da porta antes de validar",
          ticket_id: null,
          event_id: null,
        });
        return;
      }

      const now = Date.now();
      if (loadingRef.current) {
        // Keep the latest distinct guest while a request is in flight (busy door).
        if (trimmed !== lastPayloadRef.current) {
          pendingPayloadRef.current = trimmed;
        }
        return;
      }
      if (now < cooldownUntilRef.current && trimmed === lastPayloadRef.current) return;

      loadingRef.current = true;
      lastPayloadRef.current = trimmed;
      setLoading(true);
      setSessionExpired(false);

      try {
        const response = await fetch("/api/checkin/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            qrToken: trimmed,
            eventId: selectedEventId,
            deviceInfo: navigator.userAgent.slice(0, 240),
          }),
        });

        if (response.status === 401) {
          sessionExpiredRef.current = true;
          setSessionExpired(true);
          setResult({
            result: "not_found",
            message: "Sessão expirada — faça login de novo",
            ticket_id: null,
            event_id: null,
          });
          await stopScanner();
          setEntryMode("manual");
          return;
        }

        const payload = await response.json();
        const next: CheckinResponse = response.ok
          ? payload
          : {
              result: "not_found",
              message: payload.error ?? payload.message ?? "Falha na validação",
              ticket_id: null,
              event_id: null,
              reason: response.status >= 500 ? "server" : "invalid",
            };

        setResult(next);

        if (next.result === "valid") {
          setManualCode("");
        }

        if (next.result === "valid" || next.result === "already_used") {
          cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
        } else {
          cooldownUntilRef.current = Date.now() + 1200;
        }
      } catch {
        setResult({
          result: "not_found",
          message: "Falha de rede ao validar ingresso — tente de novo",
          ticket_id: null,
          event_id: null,
          reason: "network",
        });
      } finally {
        setLoading(false);
        loadingRef.current = false;

        const pending = pendingPayloadRef.current;
        pendingPayloadRef.current = null;
        if (pending && pending !== lastPayloadRef.current && !sessionExpiredRef.current) {
          void validate(pending);
        }
      }
    },
    [stopScanner],
  );

  const startScanner = useCallback(async () => {
    if (sessionExpiredRef.current) return;
    await stopScanner();
    const host = document.getElementById("qr-reader");
    if (!host) return;

    host.innerHTML = "";
    setCameraHint(null);

    try {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 6, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: true },
        false,
      );
      scannerRef.current = scanner;
      scanner.render(
        (decodedText) => {
          void validate(decodedText);
        },
        () => undefined,
      );
    } catch {
      setCameraHint("Câmera indisponível neste navegador. Use o modo Digitar código.");
      setEntryMode("manual");
    }
  }, [stopScanner, validate]);

  const entryModeRef = useRef(entryMode);
  entryModeRef.current = entryMode;

  useEffect(() => {
    void requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        if (entryModeRef.current === "camera" && !sessionExpiredRef.current) {
          void startScanner();
        }
      } else {
        void stopScanner();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void stopScanner();
      void releaseWakeLock();
    };
  }, [releaseWakeLock, requestWakeLock, startScanner, stopScanner]);

  useEffect(() => {
    if (entryMode === "camera" && eventId && !sessionExpired) {
      void startScanner();
      return () => {
        void stopScanner();
      };
    }
    void stopScanner();
  }, [entryMode, eventId, sessionExpired, startScanner, stopScanner]);

  if (!events.length) {
    return (
      <section className="rounded-lg border border-[#f5a524]/40 bg-[#261802] p-6 text-[#ffd27a]">
        <h1 className="text-xl font-black">Nenhum evento disponível</h1>
        <p className="mt-2 text-sm">Crie ou publique um evento antes de abrir a porta.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-4 shadow-sm shadow-[#ff1493]/10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-[#ff1493]" />
            <h1 className="text-xl font-black">Check-in</h1>
          </div>
          <div className="flex rounded-md border border-[#ff1493]/35 p-1 text-sm">
            <button
              type="button"
              onClick={() => setEntryMode("camera")}
              disabled={sessionExpired}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-semibold disabled:opacity-40 ${
                entryMode === "camera" ? "bg-[#ff1493] text-white" : "text-[#c9aabc]"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Câmera
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-semibold ${
                entryMode === "manual" ? "bg-[#ff1493] text-white" : "text-[#c9aabc]"
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" />
              Digitar código
            </button>
          </div>
        </div>

        <label className="mb-4 grid gap-2 text-sm font-medium">
          Evento desta porta
          <select
            value={eventId}
            onChange={(event) => {
              setEventId(event.target.value);
              setResult(null);
            }}
            className="h-11 rounded-md border border-[#ff1493]/30 bg-[#210018] px-3 text-white"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {formatEventLabel(event)}
              </option>
            ))}
          </select>
        </label>

        <p className="mb-3 text-sm text-[#c9aabc]">
          Escaneie o QR dinâmico / Wallet, ou digite o código curto da porta (ex.: AB12-CD34). Ingressos
          de outro evento são rejeitados.
        </p>

        {wakeLockActive ? (
          <p className="mb-3 text-xs text-[#8fffc1]/90">Tela mantida ligada enquanto o check-in está aberto.</p>
        ) : (
          <p className="mb-3 text-xs text-[#c9aabc]">
            Dica: mantenha a aba em primeiro plano e o brilho alto. No iPhone, se a câmera travar, use
            Digitar código.
          </p>
        )}

        {entryMode === "camera" && !sessionExpired ? (
          <>
            {cameraHint ? (
              <p className="mb-3 rounded-md border border-[#f5a524]/40 bg-[#261802] px-3 py-2 text-sm text-[#ffd27a]">
                {cameraHint}
              </p>
            ) : null}
            <div id="qr-reader" className="overflow-hidden rounded-lg" />
          </>
        ) : !sessionExpired ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void validate(manualCode);
            }}
            className="grid gap-3 rounded-lg border border-[#ff1493]/25 bg-[#210018] p-4"
          >
            <label className="grid gap-2 text-sm font-medium">
              Código da porta
              <input
                value={manualCode}
                onChange={(event) => setManualCode(formatManualInput(event.target.value))}
                className="h-14 rounded-md border border-[#ff1493]/30 bg-[#120410] px-3 text-center font-mono text-2xl tracking-[0.2em] uppercase"
                placeholder="AB12-CD34"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </label>
            <p className="text-xs text-[#c9aabc]">
              Peça o código exibido abaixo do QR no celular do convidado. Ele muda junto com o QR
              (~90s).
            </p>
            <button
              disabled={loading || manualCode.replace(/-/g, "").length < 8 || !eventId}
              className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#ff1493] font-bold text-white disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {loading ? "Validando" : "Validar código"}
            </button>
          </form>
        ) : null}
      </section>

      <aside className="grid content-start gap-4">
        {sessionExpired ? (
          <div className="rounded-lg border border-[#ff3b6b]/50 bg-[#2a050d] p-4 text-[#ff9aae]">
            <p className="font-black">Sessão expirada</p>
            <p className="mt-1 text-sm">A aba ficou em segundo plano ou o login caiu. Entre de novo.</p>
            <Link
              href={`/login?next=${encodeURIComponent("/checkin")}`}
              className="mt-3 inline-flex rounded-md bg-[#ff1493] px-4 py-2 text-sm font-bold text-white"
            >
              Fazer login
            </Link>
          </div>
        ) : null}

        {entryMode === "camera" && !sessionExpired ? (
          <button
            type="button"
            onClick={() => setEntryMode("manual")}
            className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-4 text-left text-sm text-[#c9aabc] hover:border-[#ff1493]/55"
          >
            <span className="flex items-center gap-2 font-bold text-white">
              <Keyboard className="h-4 w-4 text-[#ff1493]" />
              Câmera falhou?
            </span>
            <span className="mt-1 block">Toque para digitar o código da porta do ingresso.</span>
          </button>
        ) : null}

        {result ? (
          <div className={`rounded-lg border p-4 ${resultClass[result.result]}`}>
            <div className="flex items-center gap-2 font-black">
              {result.result === "valid" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              {result.message}
            </div>
            {result.buyer_name ? (
              <p className="mt-2 text-sm opacity-90">Participante: {result.buyer_name}</p>
            ) : null}
            {result.event_title ? (
              <p className="mt-1 text-sm opacity-80">Evento: {result.event_title}</p>
            ) : null}
            {result.entry_mode === "manual" ? (
              <p className="mt-1 text-xs opacity-70">Entrada por código digitado</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-[#ff1493]/20 bg-[#120410] p-4 text-sm text-[#c9aabc]">
            Aguardando leitura…
          </div>
        )}
      </aside>
    </div>
  );
}
