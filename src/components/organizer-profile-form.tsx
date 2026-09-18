"use client";

import { Loader2, MapPin, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AlertBanner } from "@/components/ui/alert-banner";
import { getErrorMessage } from "@/lib/client-errors";
import { formatCepInput, formatCpfCnpjInput, formatPhoneInput } from "@/lib/format";
import { organizerDocumentKind } from "@/lib/organizer-profile";

export type OrganizerProfileFormValues = {
  trade_name: string;
  legal_name: string;
  document: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  province: string | null;
  postal_code: string | null;
  birth_date: string | null;
  company_type: string | null;
};

export function OrganizerProfileForm({
  organizer,
  compact = false,
}: {
  organizer: OrganizerProfileFormValues;
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [form, setForm] = useState({
    tradeName: organizer.trade_name,
    legalName: organizer.legal_name,
    document: formatCpfCnpjInput(organizer.document ?? ""),
    phone: formatPhoneInput(organizer.phone ?? ""),
    city: organizer.city ?? "",
    address: organizer.address ?? "",
    addressNumber: organizer.address_number ?? "",
    complement: organizer.complement ?? "",
    province: organizer.province ?? "",
    postalCode: formatCepInput(organizer.postal_code ?? ""),
    birthDate: organizer.birth_date ?? "",
    companyType: organizer.company_type ?? "",
  });

  const kind = useMemo(() => organizerDocumentKind(form.document), [form.document]);

  async function lookupCep() {
    const cep = form.postalCode.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
      };
      if (data.erro) {
        setTone("error");
        setMessage("CEP não encontrado.");
        return;
      }
      setForm((current) => ({
        ...current,
        address: data.logradouro || current.address,
        province: data.bairro || current.province,
        city: data.localidade || current.city,
      }));
    } catch {
      setTone("error");
      setMessage("Não foi possível consultar o CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/organizer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeName: form.tradeName,
          legalName: form.legalName,
          document: form.document,
          phone: form.phone,
          city: form.city,
          address: form.address,
          addressNumber: form.addressNumber,
          complement: form.complement,
          province: form.province,
          postalCode: form.postalCode,
          birthDate: form.birthDate,
          companyType: form.companyType,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setTone("error");
        setMessage(getErrorMessage(body, "Não foi possível salvar o perfil."));
        return;
      }
      setTone("success");
      setMessage("Ficha salva. A TicketFly usa estes dados para cadastrar o recebedor na Stone.");
      router.refresh();
    } catch {
      setTone("error");
      setMessage("Falha de rede ao salvar o perfil.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 md:grid-cols-2">
      {compact ? null : (
        <div className="md:col-span-2">
          <h2 className="text-xl font-black">Ficha da casa</h2>
          <p className="mt-1 text-sm text-[#c9aabc]">
            A TicketFly cadastra você como recebedor na Stone com estes dados. Você não precisa abrir conta nem
            conectar nada.
          </p>
        </div>
      )}

      {message ? (
        <div className="md:col-span-2">
          <AlertBanner tone={tone}>{message}</AlertBanner>
        </div>
      ) : null}

      <label className="grid gap-1 text-sm">
        Nome da empresa
        <input
          required
          value={form.tradeName}
          onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Razão social
        <input
          required
          value={form.legalName}
          onChange={(e) => setForm({ ...form, legalName: e.target.value })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Número do documento (CPF ou CNPJ)
        <input
          required
          value={form.document}
          onChange={(e) => setForm({ ...form, document: formatCpfCnpjInput(e.target.value) })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Telefone
        <input
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
        />
      </label>
      {kind === "cpf" ? (
        <label className="grid gap-1 text-sm">
          Nascimento
          <input
            required
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
          />
        </label>
      ) : (
        <label className="grid gap-1 text-sm">
          Tipo da empresa
          <select
            required={kind === "cnpj"}
            value={form.companyType}
            onChange={(e) => setForm({ ...form, companyType: e.target.value })}
            className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
          >
            <option value="">Selecione</option>
            <option value="MEI">MEI</option>
            <option value="LIMITED">LIMITED (Ltda)</option>
            <option value="INDIVIDUAL">INDIVIDUAL (EI)</option>
            <option value="ASSOCIATION">ASSOCIATION</option>
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm">
        CEP
        <span className="flex gap-2">
          <input
            required
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: formatCepInput(e.target.value) })}
            onBlur={() => void lookupCep()}
            className="h-11 flex-1 rounded-md border border-white/10 bg-[#0d0b10] px-3"
          />
          <button
            type="button"
            onClick={() => void lookupCep()}
            disabled={cepLoading}
            className="inline-flex h-11 items-center gap-1 rounded-md border border-white/15 px-3 text-xs font-bold text-white/75"
          >
            {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Buscar
          </button>
        </span>
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        Logradouro
        <input
          required
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
          placeholder="Rua, avenida ou similar"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Número
        <input
          required
          value={form.addressNumber}
          onChange={(e) => setForm({ ...form, addressNumber: e.target.value })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Bairro
        <input
          required
          value={form.province}
          onChange={(e) => setForm({ ...form, province: e.target.value })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Cidade
        <input
          required
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Complemento
        <input
          value={form.complement}
          onChange={(e) => setForm({ ...form, complement: e.target.value })}
          className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
        />
      </label>
      <button
        disabled={loading}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-[#ff1493] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 md:col-span-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar perfil
      </button>
    </form>
  );
}
