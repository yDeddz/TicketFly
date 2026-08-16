"use client";

import { Loader2, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency } from "@/lib/format";

type Promoter = {
  id: string;
  name: string;
  code: string;
  commission_percent: number;
  is_active: boolean;
  sales_count: number;
  commission_total_cents: number;
  created_at: string;
};

export function OrganizerPromotersManager() {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("5");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<Promoter | null>(null);

  async function load() {
    const res = await fetch("/api/organizer/promoters");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao carregar promotores");
      setLoaded(true);
      return;
    }
    setPromoters(data.promoters ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  function createPromoter(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/organizer/promoters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          commissionPercent: Number(commissionPercent),
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar promotor");
        return;
      }
      setMessage(`Promotor ${data.code} criado.`);
      setName("");
      setCode("");
      setCommissionPercent("5");
      setShowCreate(false);
      await load();
    });
  }

  function requestToggle(promoter: Promoter) {
    if (promoter.is_active) {
      setPendingToggle(promoter);
      return;
    }
    toggleActive(promoter);
  }

  function toggleActive(promoter: Promoter) {
    setPendingToggle(null);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/organizer/promoters/${promoter.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !promoter.is_active }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error ?? "Erro ao atualizar");
          return;
        }
        setMessage(data.is_active ? "Promotor ativado." : "Promotor desativado.");
        await load();
      } catch {
        setError("Falha de rede ao atualizar promotor");
      }
    });
  }

  if (!loaded) {
    return <p className="text-sm text-white/55">{error ?? "Carregando promotores…"}</p>;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Promotores</h2>
          <p className="mt-1 text-sm text-[#c9aabc]">
            Códigos de afiliado da organização. Atribua vendas no checkout ou vincule a um cupom.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          Novo promotor
        </button>
      </div>

      {showCreate ? (
        <form onSubmit={createPromoter} className="grid gap-4 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 sm:grid-cols-3">
          <label className="grid gap-2 text-sm sm:col-span-1">
            <span className="font-bold text-white/70">Nome</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">Código</span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="JOAO10"
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono uppercase text-white outline-none focus:border-[#ff1493]/50"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">Comissão (%)</span>
            <input
              required
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar promotor"}
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#120410]">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-white/40">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Comissão</th>
              <th className="px-4 py-3">Vendas</th>
              <th className="px-4 py-3">Total comissão</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {promoters.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-white/45">
                  Nenhum promotor ainda. Crie o primeiro para rastrear vendas por código.
                </td>
              </tr>
            ) : (
              promoters.map((p) => (
                <tr key={p.id} className="border-t border-white/5 text-white/75">
                  <td className="px-4 py-3 font-bold text-white">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-[#ff7ec8]">{p.code}</td>
                  <td className="px-4 py-3">{Number(p.commission_percent)}%</td>
                  <td className="px-4 py-3">{p.sales_count}</td>
                  <td className="px-4 py-3">{formatCurrency(p.commission_total_cents)}</td>
                  <td className="px-4 py-3">{p.is_active ? "Ativo" : "Inativo"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => requestToggle(p)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white"
                    >
                      {p.is_active ? <ToggleRight className="h-4 w-4 text-emerald-300" /> : <ToggleLeft className="h-4 w-4" />}
                      {p.is_active ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingToggle)}
        title="Desativar promotor?"
        description={
          pendingToggle
            ? `O código ${pendingToggle.code} deixará de atribuir novas vendas.`
            : undefined
        }
        confirmLabel="Desativar"
        tone="danger"
        busy={pending}
        onCancel={() => setPendingToggle(null)}
        onConfirm={() => {
          if (pendingToggle) toggleActive(pendingToggle);
        }}
      />
    </div>
  );
}
