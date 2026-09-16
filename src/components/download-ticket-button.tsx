"use client";

import clsx from "clsx";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/lib/client-errors";

type DownloadTicketButtonProps = {
  code: string;
  accessToken?: string | null;
  className?: string;
  label?: string;
};

function withAccess(path: string, accessToken?: string | null) {
  if (!accessToken) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}access=${encodeURIComponent(accessToken)}`;
}

export function DownloadTicketButton({
  code,
  accessToken,
  className,
  label = "Baixar ingresso",
}: DownloadTicketButtonProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(withAccess(`/api/tickets/${code}/download`, accessToken), {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setMessage(getErrorMessage(payload, "Não foi possível baixar o ingresso"));
        return;
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        setMessage("Não foi possível baixar o ingresso");
        return;
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] ?? `ingresso-${code.slice(0, 8)}.png`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Falha de rede ao baixar o ingresso");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={clsx("grid gap-1.5", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-4 text-sm font-semibold text-white/85 backdrop-blur-md hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
        {busy ? "Preparando…" : label}
      </button>
      {message ? (
        <p className="text-xs text-[#ffb1d5]" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
