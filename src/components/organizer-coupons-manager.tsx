"use client";

import { Loader2, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { formatCurrency } from "@/lib/format";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  event_id: string | null;
  promoter_id: string | null;
  max_uses: number | null;
  uses_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

type EventOption = { id: string; title: string; status: string };
type PromoterOption = { id: string; name: string; code: string; is_active: boolean };

const emptyForm = {
  code: "",
  description: "",
  discountType: "percent" as "percent" | "fixed",
  discountValue: "10",
  eventId: "",
  promoterId: "",
  maxUses: "",
  startsAt: "",
  endsAt: "",
};

export function OrganizerCouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [promoters, setPromoters] = useState<PromoterOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch("/api/organizer/coupons");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao carregar cupons");
      setLoaded(true);
      return;
    }
    setCoupons(data.coupons ?? []);
    setEvents(data.events ?? []);
    setPromoters(data.promoters ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  function createCoupon(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const discountValue =
      form.discountType === "fixed"
        ? Math.round(Number(form.discountValue) * 100)
        : Number(form.discountValue);

    startTransition(async () => {
      const res = await fetch("/api/organizer/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          description: form.description,
          discountType: form.discountType,
          discountValue,
          eventId: form.eventId || null,
          promoterId: form.promoterId || null,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar cupom");
        return;
      }
      setMessage(`Cupom ${data.code} criado.`);
      setForm(emptyForm);
      setShowCreate(false);
      await load();
    });
  }

  function toggleActive(coupon: Coupon) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/organizer/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao atualizar");
        return;
      }
      setMessage(data.is_active ? "Cupom ativado." : "Cupom desativado.");
      await load();
    });
  }

  function discountLabel(coupon: Coupon) {
    if (coupon.discount_type === "percent") {
      return `${Number(coupon.discount_value)}%`;
    }
    return formatCurrency(Number(coupon.discount_value));
  }

  function eventTitle(eventId: string | null) {
    if (!eventId) return "Toda a organização";
    return events.find((e) => e.id === eventId)?.title ?? "Evento";
  }

  function promoterLabel(promoterId: string | null) {
    if (!promoterId) return "—";
    const p = promoters.find((item) => item.id === promoterId);
    return p ? `${p.name} (${p.code})` : "—";
  }

  if (!loaded) {
    return <p className="text-sm text-white/55">{error ?? "Carregando cupons…"}</p>;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Cupons de desconto</h2>
          <p className="mt-1 text-sm text-[#c9aabc]">
            Crie cupons para a organização, um evento específico ou vinculado a um promotor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          Novo cupom
        </button>
      </div>

      {showCreate ? (
        <form onSubmit={createCoupon} className="grid gap-4 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">Código</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="BALADA20"
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono uppercase text-white outline-none focus:border-[#ff1493]/50"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">Descrição (opcional)</span>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">Tipo de desconto</span>
            <select
              value={form.discountType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  discountType: e.target.value as "percent" | "fixed",
                  discountValue: e.target.value === "fixed" ? "10" : "10",
                }))
              }
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            >
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">
              {form.discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"}
            </span>
            <input
              required
              type="number"
              min={form.discountType === "percent" ? 1 : 0.01}
              max={form.discountType === "percent" ? 100 : undefined}
              step={form.discountType === "percent" ? 1 : 0.01}
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">Escopo</span>
            <select
              value={form.eventId}
              onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            >
              <option value="">Toda a organização</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} ({event.status})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">Promotor (opcional)</span>
            <select
              value={form.promoterId}
              onChange={(e) => setForm((f) => ({ ...f, promoterId: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            >
              <option value="">Nenhum</option>
              {promoters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.code}
                </option>
              ))}
            </select>
            <span className="text-xs text-white/45">
              Se vinculado, a venda com este cupom credita o promotor automaticamente.
            </span>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white/70">Limite de usos</span>
            <input
              type="number"
              min={1}
              value={form.maxUses}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
              placeholder="Ilimitado"
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2 md:col-span-1">
            <label className="grid gap-2 text-sm">
              <span className="font-bold text-white/70">Início</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-bold text-white/70">Fim</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#ff1493]/50"
              />
            </label>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar cupom
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
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Desconto</th>
              <th className="px-4 py-3">Escopo</th>
              <th className="px-4 py-3">Promotor</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-white/45">
                  Nenhum cupom ainda. Crie um para a organização ou para um promotor.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id} className="border-t border-white/5 text-white/75">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-[#ff7ec8]">{coupon.code}</div>
                    {coupon.description ? <div className="text-xs text-white/45">{coupon.description}</div> : null}
                  </td>
                  <td className="px-4 py-3">{discountLabel(coupon)}</td>
                  <td className="px-4 py-3">{eventTitle(coupon.event_id)}</td>
                  <td className="px-4 py-3">{promoterLabel(coupon.promoter_id)}</td>
                  <td className="px-4 py-3">
                    {coupon.uses_count}
                    {coupon.max_uses != null ? ` / ${coupon.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-3">{coupon.is_active ? "Ativo" : "Inativo"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleActive(coupon)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white"
                    >
                      {coupon.is_active ? (
                        <ToggleRight className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                      {coupon.is_active ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
