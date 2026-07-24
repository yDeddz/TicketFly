"use client";

import clsx from "clsx";
import { Download, Loader2, Smartphone, Wallet } from "lucide-react";
import { useState } from "react";

type WalletButtonProps = {
  code: string;
  accessToken?: string | null;
  className?: string;
  label?: string;
  compact?: boolean;
};

type Busy = "apple" | "google" | "qr" | null;

function withAccess(path: string, accessToken?: string | null) {
  if (!accessToken) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}access=${encodeURIComponent(accessToken)}`;
}

export function WalletButton({
  code,
  accessToken,
  className,
  label = "Adicionar à Wallet",
  compact = false,
}: WalletButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function addApple() {
    setBusy("apple");
    setMessage(null);
    try {
      const response = await fetch(withAccess(`/api/tickets/${code}/wallet/apple`, accessToken));
      if (response.status === 503 || response.status === 500) {
        const payload = await response.json().catch(() => ({}));
        setMessage(payload.message ?? "Apple Wallet ainda não configurada neste ambiente. Baixe o QR.");
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setMessage(payload.error ?? "Não foi possível gerar o pass Apple");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pinkpass-${code.slice(0, 8)}.pkpass`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Pass Apple baixado.");
    } catch {
      setMessage("Falha de rede ao gerar Apple Wallet");
    } finally {
      setBusy(null);
    }
  }

  async function addGoogle() {
    setBusy("google");
    setMessage(null);
    try {
      const response = await fetch(withAccess(`/api/tickets/${code}/wallet/google`, accessToken));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.message ?? payload.error ?? "Google Wallet não disponível");
        return;
      }
      window.location.href = payload.saveUrl;
    } catch {
      setMessage("Falha de rede ao abrir Google Wallet");
      setBusy(null);
    }
  }

  function downloadQr() {
    setBusy("qr");
    setMessage(null);
    const href = withAccess(`/api/tickets/${code}/wallet/qr`, accessToken);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `pinkpass-${code.slice(0, 8)}.png`;
    anchor.click();
    setMessage("QR baixado — salve em Fotos / Arquivos.");
    setBusy(null);
  }

  return (
    <div className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          "btn h-11 border border-white/12 bg-white/[0.04] px-4 text-sm text-white/85 backdrop-blur-md",
          "hover:border-white/25 hover:bg-white/[0.08] active:translate-y-0",
          compact && "w-full justify-center",
        )}
      >
        <Wallet className="h-4 w-4" aria-hidden />
        {label}
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-white/12 bg-[#120410] p-2 shadow-xl shadow-black/40">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void addApple()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/[0.06] disabled:opacity-60"
          >
            {busy === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Apple Wallet
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void addGoogle()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/[0.06] disabled:opacity-60"
          >
            {busy === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Google Wallet
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={downloadQr}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/[0.06] disabled:opacity-60"
          >
            {busy === "qr" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar QR (fallback)
          </button>
          {message ? <p className="px-3 pb-2 pt-1 text-xs text-[#ffb1d5]">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
