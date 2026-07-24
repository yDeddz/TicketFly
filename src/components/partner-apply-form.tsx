"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PartnerApplyForm() {
  const router = useRouter();
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [feeNote, setFeeNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/organizer/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradeName,
        legalName,
        document,
        phone,
        city,
        feeNote,
      }),
    });

    const body = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Não foi possível enviar a candidatura.");
      return;
    }

    router.push("/organizador");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="glass-panel grid gap-4 rounded-2xl p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">Candidatura</p>
        <h2 className="mt-2 text-3xl font-black">Dados da balada</h2>
        <p className="mt-2 text-sm text-white/58">
          Envie sua proposta. O admin TicketFly avalia e libera o contrato de taxa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Nome fantasia
          <input
            required
            value={tradeName}
            onChange={(event) => setTradeName(event.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-[#0d0b10] px-3 outline-none transition duration-200 focus:border-[#ff1493]/70"
            placeholder="Ex.: Club Neon"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Razão social
          <input
            required
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-[#0d0b10] px-3 outline-none transition duration-200 focus:border-[#ff1493]/70"
            placeholder="Empresa Ltda"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          CNPJ / CPF
          <input
            required
            value={document}
            onChange={(event) => setDocument(event.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-[#0d0b10] px-3 outline-none transition duration-200 focus:border-[#ff1493]/70"
            placeholder="00.000.000/0000-00"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Telefone / WhatsApp
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-[#0d0b10] px-3 outline-none transition duration-200 focus:border-[#ff1493]/70"
            placeholder="(11) 99999-9999"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Cidade
        <input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="h-12 rounded-xl border border-white/10 bg-[#0d0b10] px-3 outline-none transition duration-200 focus:border-[#ff1493]/70"
          placeholder="São Paulo"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Como quer negociar a % da taxa de serviço?
        <textarea
          value={feeNote}
          onChange={(event) => setFeeNote(event.target.value)}
          rows={4}
          className="rounded-xl border border-white/10 bg-[#0d0b10] px-3 py-3 outline-none transition duration-200 focus:border-[#ff1493]/70"
          placeholder="Ex.: quero receber 30% da taxa de serviço nas noites de sexta e sábado."
        />
      </label>

      {error ? (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      <button
        disabled={loading}
        className="neon-button flex min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-black disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Enviar candidatura de parceiro
      </button>
    </form>
  );
}
