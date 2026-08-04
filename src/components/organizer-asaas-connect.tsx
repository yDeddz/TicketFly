"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  asaasReady: boolean;
  asaasConfigured: boolean;
  asaasStatus: string;
  asaasWalletId: string | null;
  primaryProvider: string;
  tradeName: string;
  defaultEmail?: string;
};

export function OrganizerAsaasConnectForm({
  asaasReady,
  asaasConfigured,
  asaasStatus,
  asaasWalletId,
  primaryProvider,
  tradeName,
  defaultEmail = "",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function setPrimary(provider: "mercado_pago" | "asaas") {
    setError(null);
    const res = await fetch("/api/organizer/payments/primary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Não foi possível alterar o provedor");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      cpfCnpj: String(formData.get("cpfCnpj") ?? ""),
      birthDate: String(formData.get("birthDate") ?? ""),
      companyType: String(formData.get("companyType") ?? "") || undefined,
      phone: String(formData.get("phone") ?? ""),
      mobilePhone: String(formData.get("mobilePhone") ?? ""),
      address: String(formData.get("address") ?? ""),
      addressNumber: String(formData.get("addressNumber") ?? ""),
      complement: String(formData.get("complement") ?? ""),
      province: String(formData.get("province") ?? ""),
      postalCode: String(formData.get("postalCode") ?? ""),
    };

    const res = await fetch("/api/organizer/asaas/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Falha ao conectar Asaas");
      return;
    }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-sky-400/25 bg-[#0a1218] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Asaas</p>
          <p className="mt-2 text-2xl font-black capitalize">{asaasStatus}</p>
          {asaasWalletId ? (
            <p className="mt-1 text-sm text-white/50">Wallet: {asaasWalletId}</p>
          ) : null}
          <p className="mt-2 text-sm text-[#a8c4d4]">
            PIX, boleto e cartão com split automático do seu líquido na subconta Asaas.
          </p>
        </div>
        {asaasReady && primaryProvider !== "asaas" ? (
          <button
            type="button"
            disabled={pending}
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
      ) : !asaasReady ? (
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-fit rounded-full bg-sky-500 px-4 py-2.5 text-sm font-bold text-[#041018]"
          >
            {open ? "Fechar formulário" : "Criar / conectar subconta Asaas"}
          </button>

          {open ? (
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void onSubmit(new FormData(e.currentTarget));
              }}
            >
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">Nome / razão social</span>
                <input
                  name="name"
                  required
                  defaultValue={tradeName}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">E-mail Asaas</span>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={defaultEmail}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">CPF ou CNPJ</span>
                <input
                  name="cpfCnpj"
                  required
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">Nascimento (PF) YYYY-MM-DD</span>
                <input
                  name="birthDate"
                  placeholder="1990-01-15"
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">Tipo empresa (CNPJ)</span>
                <select name="companyType" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                  <option value="">—</option>
                  <option value="MEI">MEI</option>
                  <option value="LIMITED">LIMITED</option>
                  <option value="INDIVIDUAL">INDIVIDUAL</option>
                  <option value="ASSOCIATION">ASSOCIATION</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">Celular</span>
                <input
                  name="mobilePhone"
                  required
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">Telefone</span>
                <input name="phone" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">CEP</span>
                <input
                  name="postalCode"
                  required
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-white/55">Endereço</span>
                <input
                  name="address"
                  required
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">Número</span>
                <input
                  name="addressNumber"
                  required
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-white/55">Bairro</span>
                <input
                  name="province"
                  required
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-white/55">Complemento</span>
                <input name="complement" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2" />
              </label>
              <button
                type="submit"
                disabled={pending}
                className="md:col-span-2 w-fit rounded-full bg-sky-500 px-4 py-2.5 text-sm font-bold text-[#041018] disabled:opacity-50"
              >
                {pending ? "Conectando…" : "Criar subconta e ativar Asaas"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
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
        disabled={pending}
        onClick={() => {
          setError(null);
          void fetch("/api/organizer/payments/primary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "mercado_pago" }),
          })
            .then(async (res) => {
              const data = (await res.json()) as { error?: string };
              if (!res.ok) {
                setError(data.error ?? "Falha ao ativar Mercado Pago");
                return;
              }
              startTransition(() => router.refresh());
            })
            .catch(() => setError("Falha ao ativar Mercado Pago"));
        }}
        className="rounded-full border border-[#ff1493]/40 px-4 py-2.5 text-sm font-bold text-[#ffb3d9] disabled:opacity-50"
      >
        Usar Mercado Pago no checkout
      </button>
      {error ? <p className="text-xs text-amber-100">{error}</p> : null}
    </div>
  );
}
