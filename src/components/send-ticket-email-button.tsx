"use client";

import { Mail } from "lucide-react";
import { useState } from "react";

export function SendTicketEmailButton({
  code,
  accessToken,
  className,
}: {
  code: string;
  accessToken?: string | null;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send() {
    setState("sending");
    setMessage("");
    const qs = accessToken ? `?access=${encodeURIComponent(accessToken)}` : "";
    try {
      const response = await fetch(`/api/tickets/${code}/email${qs}`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setState("error");
        setMessage(body?.error ?? "Não foi possível enviar o e-mail");
        return;
      }
      setState("sent");
      setMessage("Enviado para o e-mail da compra");
    } catch {
      setState("error");
      setMessage("Falha de rede ao enviar o e-mail");
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void send()}
        disabled={state === "sending"}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/15 px-4 text-sm font-bold text-white/85 hover:bg-white/5 disabled:opacity-60"
      >
        <Mail className="h-4 w-4" aria-hidden />
        {state === "sending" ? "Enviando…" : state === "sent" ? "E-mail enviado" : "Enviar ingresso por e-mail"}
      </button>
      {message ? (
        <p className={`mt-2 text-center text-xs ${state === "error" ? "text-[#ff9aae]" : "text-[#8fffc1]"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
