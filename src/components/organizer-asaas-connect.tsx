"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { connectionStatusLabel } from "@/lib/organizer-profile";
import { getErrorMessage } from "@/lib/client-errors";

type Props = {
  asaasReady: boolean;
  asaasConfigured: boolean;
  asaasStatus: string;
  asaasAccountStatus: string | null;
  primaryProvider: string;
  profileComplete: boolean;
};

export function OrganizerAsaasConnectForm({
  asaasReady,
  asaasConfigured,
  asaasStatus,
  asaasAccountStatus,
  primaryProvider,
  profileComplete,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setPrimary(provider: "mercado_pago" | "asaas") {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/organizer/payments/primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(getErrorMessage(data, "Não foi possível alterar a forma de recebimento"));
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/organizer/asaas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(getErrorMessage(data, "Falha ao conectar Asaas"));
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/organizer/asaas/sync", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(getErrorMessage(data, "Falha ao sincronizar Asaas"));
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <div className="grid gap-4 rounded-2xl border border-sky-400/25 bg-[#0a1218] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Asaas</p>
          <p className="mt-2 text-2xl font-black">{connectionStatusLabel(asaasStatus)}</p>
          {asaasAccountStatus ? (
            <p className="mt-1 text-sm text-white/50">Status da conta: {asaasAccountStatus}</p>
          ) : null}
          <p className="mt-2 text-sm text-[#a8c4d4]">
            PIX, boleto e cartão com split automático do seu líquido na subconta Asaas.
          </p>
        </div>
        {asaasReady && primaryProvider !== "asaas" ? (
          <button
            type="button"
            disabled={working}
            onClick={() => void setPrimary("asaas")}
            className="rounded-full border border-sky-300/40 px-4 py-2.5 text-sm font-bold text-sky-100 disabled:opacity-50"
          >
            Usar Asaas no checkout
          </button>
        ) : null}
        {asaasReady && primaryProvider === "asaas" ? (
          <span className="rounded-full bg-sky-400/15 px-4 py-2.5 text-sm font-bold text-sky-100">
            Provedor ativo
          </span>
        ) : null}
      </div>

      {!asaasConfigured ? (
        <p className="text-sm text-white/55">Asaas pendente de configuração no servidor (ASAAS_API_KEY).</p>
      ) : !profileComplete ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Complete o{" "}
          <Link href="/organizador/perfil" className="font-bold underline">
            perfil fiscal
          </Link>{" "}
          (documento, endereço, CEP e telefone) para criar a subconta.
        </p>
      ) : !asaasReady ? (
        <button
          type="button"
          disabled={working}
          onClick={() => void connect()}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-bold text-[#041018] disabled:opacity-50"
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {working ? "Conectando…" : "Criar / conectar subconta Asaas"}
        </button>
      ) : (
        <button
          type="button"
          disabled={working}
          onClick={() => void sync()}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/40 px-4 py-2.5 text-sm font-bold text-sky-100 disabled:opacity-50"
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sincronizar status Asaas
        </button>
      )}

      {error ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{error}</p>
      ) : null}
    </div>
  );
}

export function OrganizerSetPrimaryMpButton({
  enabled,
  isPrimary,
}: {
  enabled: boolean;
  isPrimary: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;
  if (isPrimary) {
    return (
      <span className="rounded-full bg-[#ff1493]/20 px-4 py-2.5 text-sm font-bold text-[#ffb3d9]">
        Provedor ativo
      </span>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={busy || pending}
        onClick={() => {
          setError(null);
          setBusy(true);
          void fetch("/api/organizer/payments/primary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "mercado_pago" }),
          })
            .then(async (res) => {
              const data = (await res.json()) as { error?: string };
              if (!res.ok) {
                setError(getErrorMessage(data, "Falha ao ativar Mercado Pago"));
                return;
              }
              startTransition(() => router.refresh());
            })
            .catch(() => setError("Falha ao ativar Mercado Pago"))
            .finally(() => setBusy(false));
        }}
        className="rounded-full border border-[#ff1493]/40 px-4 py-2.5 text-sm font-bold text-[#ffb3d9] disabled:opacity-50"
      >
        {busy || pending ? "Ativando…" : "Usar Mercado Pago no checkout"}
      </button>
      {error ? <p className="text-xs text-amber-100">{error}</p> : null}
    </div>
  );
}
