"use client";

import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, CheckCircle2, Search, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CheckinResponse = {
  result: "valid" | "already_used" | "cancelled" | "not_found" | "not_paid";
  message: string;
  ticket_id: string | null;
  event_id: string | null;
};

const resultClass: Record<CheckinResponse["result"], string> = {
  valid: "bg-[#062417] text-[#8fffc1] border-[#25d47a]/50",
  already_used: "bg-[#261802] text-[#ffd27a] border-[#f5a524]/50",
  cancelled: "bg-[#2a050d] text-[#ff9aae] border-[#ff3b6b]/50",
  not_found: "bg-[#140713] text-[#f7bddc] border-[#ff1493]/35",
  not_paid: "bg-[#261802] text-[#ffd27a] border-[#f5a524]/50",
};

export function CheckinScanner() {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const loadingRef = useRef(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = useCallback(async (qrToken: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const response = await fetch("/api/checkin/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        qrToken,
        deviceInfo: navigator.userAgent,
      }),
    });

    const payload = await response.json();
    setLoading(false);
    loadingRef.current = false;
    setResult(response.ok ? payload : { result: "not_found", message: payload.error, ticket_id: null, event_id: null });
  }, []);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 8, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: true },
      false,
    );

    scannerRef.current.render(
      (decodedText) => validate(decodedText),
      () => undefined,
    );

    return () => {
      scannerRef.current?.clear().catch(() => undefined);
    };
  }, [validate]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-[#ff1493]/30 bg-[#120410] p-4 shadow-sm shadow-[#ff1493]/10">
        <div className="mb-4 flex items-center gap-2">
          <Camera className="h-5 w-5 text-[#ff1493]" />
          <h1 className="text-xl font-black">Check-in</h1>
        </div>
        <div id="qr-reader" className="overflow-hidden rounded-lg" />
      </section>

      <aside className="grid content-start gap-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            validate(manualCode);
          }}
          className="grid gap-3 rounded-lg border border-[#ff1493]/30 bg-[#120410] p-4 shadow-sm shadow-[#ff1493]/10"
        >
          <label className="grid gap-2 text-sm font-medium">
            Código manual
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              className="h-11 rounded-md border border-[#ff1493]/30 px-3"
            />
          </label>
          <button
            disabled={loading}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#ff1493] font-bold text-white disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {loading ? "Validando" : "Validar"}
          </button>
        </form>

        {result ? (
          <div className={`rounded-lg border p-4 ${resultClass[result.result]}`}>
            <div className="flex items-center gap-2 font-black">
              {result.result === "valid" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              {result.message}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
