"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatCurrency } from "@/lib/format";
import type { MpConnectionStatus } from "@/types/domain";

type AdminOrganizer = {
  id: string;
  trade_name: string;
  legal_name: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  fee_threshold_cents: number;
  fee_percent_upto_threshold: number;
  fee_percent_above_threshold: number;
  mp_connection_status: MpConnectionStatus;
  partnership_notes: string | null;
  created_at: string;
};

type FormState = {
  status: AdminOrganizer["status"];
  feeThresholdCents: string;
  feePercentUptoThreshold: string;
  feePercentAboveThreshold: string;
};

const statusLabels: Record<AdminOrganizer["status"], string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  suspended: "Suspenso",
};

const mpLabels: Record<MpConnectionStatus, string> = {
  disconnected: "Desconectado",
  connected: "Conectado",
  pending: "Pendente",
};

export function AdminOrganizersManager({ organizers }: { organizers: AdminOrganizer[] }) {
  const router = useRouter();
  const [forms, setForms] = useState<Record<string, FormState>>(() =>
    Object.fromEntries(organizers.map((organizer) => [organizer.id, organizerToForm(organizer)])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function updateField(id: string, field: keyof FormState, value: string) {
    setForms((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  }

  async function saveOrganizer(organizerId: string) {
    const form = forms[organizerId];
    setSavingId(organizerId);
    setMessage("");

    const response = await fetch(`/api/admin/organizers/${organizerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.status,
        feeThresholdCents: Number(form.feeThresholdCents),
        feePercentUptoThreshold: Number(form.feePercentUptoThreshold),
        feePercentAboveThreshold: Number(form.feePercentAboveThreshold),
        serviceFeePlatformSharePercent: 50,
      }),
    });

    const body = await response.json().catch(() => null);
    setSavingId(null);

    if (!response.ok) {
      setMessage(body?.error ?? "Nao foi possivel salvar o organizador.");
      return;
    }

    setMessage("Contrato do organizador atualizado.");
    router.refresh();
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-2xl font-black">Contratos das baladas</h2>
        <p className="mt-1 text-sm text-[#c9aabc]">
          Status, faixas de taxa de serviço e conexão Mercado Pago.
        </p>
      </div>

      {message ? (
        <p className="rounded-lg border border-[#ff1493]/25 bg-[#ff1493]/10 px-4 py-3 text-sm text-[#ffb1d5]">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4">
        {organizers.map((organizer) => {
          const form = forms[organizer.id];
          const saving = savingId === organizer.id;

          return (
            <div
              key={organizer.id}
              className="grid gap-4 rounded-lg border border-[#ff1493]/30 bg-[#120410] p-5 shadow-sm shadow-[#ff1493]/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="text-lg">{organizer.trade_name}</strong>
                  <p className="text-sm text-[#c9aabc]">{organizer.legal_name}</p>
                  {organizer.partnership_notes ? (
                    <p className="mt-2 max-w-2xl text-sm text-white/65">
                      Negociação: {organizer.partnership_notes}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-md border border-white/10 px-3 py-1 text-xs font-bold uppercase text-white/70">
                  MP: {mpLabels[organizer.mp_connection_status]}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-2 text-sm">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => updateField(organizer.id, "status", event.target.value)}
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  Limiar (centavos)
                  <input
                    type="number"
                    min={0}
                    value={form.feeThresholdCents}
                    onChange={(event) => updateField(organizer.id, "feeThresholdCents", event.target.value)}
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  />
                  <span className="text-xs text-[#c9aabc]">
                    Até {formatCurrency(Number(form.feeThresholdCents) || 0)}
                  </span>
                </label>

                <label className="grid gap-2 text-sm">
                  Taxa até o limiar (%)
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.01}
                    value={form.feePercentUptoThreshold}
                    onChange={(event) =>
                      updateField(organizer.id, "feePercentUptoThreshold", event.target.value)
                    }
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  Taxa acima do limiar (%)
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.01}
                    value={form.feePercentAboveThreshold}
                    onChange={(event) =>
                      updateField(organizer.id, "feePercentAboveThreshold", event.target.value)
                    }
                    className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => saveOrganizer(organizer.id)}
                className="inline-flex w-fit items-center gap-2 rounded-md bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar contrato
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function organizerToForm(organizer: AdminOrganizer): FormState {
  return {
    status: organizer.status,
    feeThresholdCents: String(organizer.fee_threshold_cents),
    feePercentUptoThreshold: String(organizer.fee_percent_upto_threshold),
    feePercentAboveThreshold: String(organizer.fee_percent_above_threshold),
  };
}
