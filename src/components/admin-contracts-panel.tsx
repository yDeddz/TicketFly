"use client";

import { Loader2, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatCurrency, reaisToCents, centsToReaisInput } from "@/lib/format";
import type { MpConnectionStatus } from "@/types/domain";

type AdminOrganizer = {
  id: string;
  trade_name: string;
  legal_name: string;
  document: string;
  phone: string | null;
  city: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  fee_threshold_cents: number;
  fee_percent_upto_threshold: number;
  fee_percent_above_threshold: number;
  service_fee_platform_share_percent: number;
  mp_connection_status: MpConnectionStatus;
  partnership_notes: string | null;
  created_at: string;
};

type FormState = {
  status: AdminOrganizer["status"];
  feeThresholdReais: string;
  feePercentUptoThreshold: string;
  feePercentAboveThreshold: string;
  serviceFeePlatformSharePercent: string;
};

const statusLabels: Record<AdminOrganizer["status"], string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  suspended: "Suspenso",
};

export function AdminContractsPanel({ organizers }: { organizers: AdminOrganizer[] }) {
  const router = useRouter();
  const [forms, setForms] = useState<Record<string, FormState>>(() =>
    Object.fromEntries(organizers.map((o) => [o.id, organizerToForm(o)])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    tradeName: "",
    legalName: "",
    document: "",
    phone: "",
    city: "",
    partnershipNotes: "",
    feeThresholdReais: "120,00",
    feePercentUptoThreshold: "12",
    feePercentAboveThreshold: "9",
    serviceFeePlatformSharePercent: "50",
    status: "approved" as AdminOrganizer["status"],
  });

  async function saveOrganizer(organizerId: string) {
    const form = forms[organizerId];
    const feeThresholdCents = reaisToCents(form.feeThresholdReais);
    if (feeThresholdCents === null) {
      setMessage("Informe o limiar de taxa em reais (ex.: 120,00).");
      return;
    }
    setSavingId(organizerId);
    setMessage("");
    const response = await fetch(`/api/admin/organizers/${organizerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.status,
        feeThresholdCents,
        feePercentUptoThreshold: Number(form.feePercentUptoThreshold),
        feePercentAboveThreshold: Number(form.feePercentAboveThreshold),
        serviceFeePlatformSharePercent: Number(form.serviceFeePlatformSharePercent),
      }),
    });
    const body = await response.json().catch(() => null);
    setSavingId(null);
    if (!response.ok) {
      setMessage(body?.error ?? "Não foi possível salvar o contrato.");
      return;
    }
    setMessage("Contrato atualizado.");
    router.refresh();
  }

  async function createContract(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    const feeThresholdCents = reaisToCents(createForm.feeThresholdReais);
    if (feeThresholdCents === null) {
      setCreating(false);
      setMessage("Informe o limiar de taxa em reais (ex.: 120,00).");
      return;
    }
    const response = await fetch("/api/admin/organizers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: createForm.email,
        tradeName: createForm.tradeName,
        legalName: createForm.legalName,
        document: createForm.document,
        phone: createForm.phone,
        city: createForm.city,
        partnershipNotes: createForm.partnershipNotes,
        feeThresholdCents,
        feePercentUptoThreshold: Number(createForm.feePercentUptoThreshold),
        feePercentAboveThreshold: Number(createForm.feePercentAboveThreshold),
        serviceFeePlatformSharePercent: Number(createForm.serviceFeePlatformSharePercent),
        status: createForm.status,
      }),
    });
    const body = await response.json().catch(() => null);
    setCreating(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Erro ao criar contrato.");
      return;
    }
    setShowCreate(false);
    setMessage(
      body?.invited
        ? "Contrato criado. O parceiro recebeu e-mail para definir a senha."
        : "Contrato criado. Peça ao parceiro para usar “Esqueci a senha” em /login se ainda não tiver acesso.",
    );
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Contratos das baladas</h2>
          <p className="mt-1 text-sm text-[#c9aabc]">
            Aprove parceiros, defina faixas de taxa e registre novas baladas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          Novo contrato
        </button>
      </div>

      {message ? (
        <p className="rounded-xl border border-[#ff1493]/25 bg-[#ff1493]/10 px-4 py-3 text-sm text-[#ffb1d5]">{message}</p>
      ) : null}

      {showCreate ? (
        <form onSubmit={createContract} className="grid gap-4 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5">
          <h3 className="text-lg font-black">Criar contrato</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="E-mail do responsável" value={createForm.email} onChange={(v) => setCreateForm({ ...createForm, email: v })} required type="email" />
            <Field label="Nome fantasia" value={createForm.tradeName} onChange={(v) => setCreateForm({ ...createForm, tradeName: v })} required />
            <Field label="Razão social" value={createForm.legalName} onChange={(v) => setCreateForm({ ...createForm, legalName: v })} required />
            <Field label="CNPJ/CPF" value={createForm.document} onChange={(v) => setCreateForm({ ...createForm, document: v })} required />
            <Field label="Telefone" value={createForm.phone} onChange={(v) => setCreateForm({ ...createForm, phone: v })} />
            <Field label="Cidade" value={createForm.city} onChange={(v) => setCreateForm({ ...createForm, city: v })} />
            <Field label="Limiar da taxa (R$)" value={createForm.feeThresholdReais} onChange={(v) => setCreateForm({ ...createForm, feeThresholdReais: v })} />
            <Field label="Taxa até limiar (%)" value={createForm.feePercentUptoThreshold} onChange={(v) => setCreateForm({ ...createForm, feePercentUptoThreshold: v })} type="number" />
            <Field label="Taxa acima (%)" value={createForm.feePercentAboveThreshold} onChange={(v) => setCreateForm({ ...createForm, feePercentAboveThreshold: v })} type="number" />
            <Field
              label="% taxa Ticket Fly (resto = parceiro)"
              value={createForm.serviceFeePlatformSharePercent}
              onChange={(v) => setCreateForm({ ...createForm, serviceFeePlatformSharePercent: v })}
              type="number"
            />
            <label className="grid gap-2 text-sm">
              Status inicial
              <select
                value={createForm.status}
                onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as AdminOrganizer["status"] })}
                className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm">
            Notas de negociação
            <textarea
              value={createForm.partnershipNotes}
              onChange={(e) => setCreateForm({ ...createForm, partnershipNotes: e.target.value })}
              rows={3}
              className="rounded-md border border-white/10 bg-[#0d0b10] px-3 py-2"
              placeholder="Ex.: split 50/50 da taxa de serviço"
            />
          </label>
          <button disabled={creating} className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Salvar contrato
          </button>
        </form>
      ) : null}

      <div className="grid gap-4">
        {organizers.length === 0 && !showCreate ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-white/60">
            Nenhum contrato ainda. Crie o primeiro parceiro para publicar eventos de teste.
          </p>
        ) : null}
        {organizers.map((organizer) => {
          const form = forms[organizer.id];
          if (!form) return null;
          const saving = savingId === organizer.id;
          return (
            <div key={organizer.id} className="grid gap-4 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="text-lg">{organizer.trade_name}</strong>
                  <p className="text-sm text-[#c9aabc]">{organizer.legal_name} · {organizer.document}</p>
                  {organizer.partnership_notes ? (
                    <p className="mt-2 max-w-2xl text-sm text-white/65">Negociação: {organizer.partnership_notes}</p>
                  ) : null}
                </div>
                <span className="rounded-md border border-white/10 px-3 py-1 text-xs font-bold uppercase text-white/70">
                  MP: {organizer.mp_connection_status}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="grid gap-2 text-sm">
                  Status
                  <select
                    value={form.status}
                    onChange={(e) => setForms((c) => ({ ...c, [organizer.id]: { ...c[organizer.id], status: e.target.value as AdminOrganizer["status"] } }))}
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Limiar da taxa (R$)
                  <input
                    inputMode="decimal"
                    value={form.feeThresholdReais}
                    onChange={(e) => setForms((c) => ({ ...c, [organizer.id]: { ...c[organizer.id], feeThresholdReais: e.target.value } }))}
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  />
                  <span className="text-xs text-[#c9aabc]">
                    Até {formatCurrency(reaisToCents(form.feeThresholdReais) ?? 0)} cobra a taxa menor
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  Taxa até limiar (%)
                  <input
                    type="number"
                    step="0.01"
                    value={form.feePercentUptoThreshold}
                    onChange={(e) => setForms((c) => ({ ...c, [organizer.id]: { ...c[organizer.id], feePercentUptoThreshold: e.target.value } }))}
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Taxa acima (%)
                  <input
                    type="number"
                    step="0.01"
                    value={form.feePercentAboveThreshold}
                    onChange={(e) => setForms((c) => ({ ...c, [organizer.id]: { ...c[organizer.id], feePercentAboveThreshold: e.target.value } }))}
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  % taxa Ticket Fly
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={form.serviceFeePlatformSharePercent}
                    onChange={(e) =>
                      setForms((c) => ({
                        ...c,
                        [organizer.id]: { ...c[organizer.id], serviceFeePlatformSharePercent: e.target.value },
                      }))
                    }
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  />
                  <span className="text-xs text-[#c9aabc]">
                    Parceiro fica com {100 - (Number(form.serviceFeePlatformSharePercent) || 0)}%
                  </span>
                </label>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveOrganizer(organizer.id)}
                className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar contrato
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
      />
    </label>
  );
}

function organizerToForm(organizer: AdminOrganizer): FormState {
  return {
    status: organizer.status,
    feeThresholdReais: centsToReaisInput(organizer.fee_threshold_cents),
    feePercentUptoThreshold: String(organizer.fee_percent_upto_threshold),
    feePercentAboveThreshold: String(organizer.fee_percent_above_threshold),
    serviceFeePlatformSharePercent: String(organizer.service_fee_platform_share_percent ?? 50),
  };
}
