"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AlertBanner } from "@/components/ui/alert-banner";
import { getErrorMessage } from "@/lib/client-errors";

type StaffMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

export function AdminStaffManager({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  async function grant(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "checkin" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setTone("error");
        setMessage(getErrorMessage(body, "Não foi possível liberar o check-in"));
        return;
      }
      setEmail("");
      setTone("success");
      setMessage(`${body.email} agora acessa /checkin.`);
      router.refresh();
    } catch {
      setTone("error");
      setMessage("Falha de rede ao atualizar a equipe.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(member: StaffMember) {
    setRevokingId(member.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email, role: "customer" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setTone("error");
        setMessage(getErrorMessage(body, "Não foi possível remover o acesso"));
        return;
      }
      setTone("success");
      setMessage(`Acesso de check-in removido de ${member.email}.`);
      router.refresh();
    } catch {
      setTone("error");
      setMessage("Falha de rede ao remover o acesso.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={grant} className="grid gap-3 rounded-2xl border border-[#ff1493]/30 bg-[#120410] p-5 md:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm">
          E-mail do operador
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="operador@casa.com"
            className="h-11 rounded-md border border-white/10 bg-[#0d0b10] px-3"
          />
        </label>
        <button
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-full bg-[#ff1493] px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Liberar /checkin
        </button>
      </form>

      {message ? <AlertBanner tone={tone}>{message}</AlertBanner> : null}

      {staff.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-white/60">
          Nenhum operador dedicado. Organizadores e admins já entram em /checkin; use esta lista só para a equipe da porta.
        </p>
      ) : (
        <div className="grid gap-2">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#120410] px-4 py-3"
            >
              <div>
                <strong className="text-sm">{member.full_name || member.email}</strong>
                <p className="text-xs text-white/50">{member.email}</p>
              </div>
              <button
                type="button"
                disabled={revokingId === member.id}
                onClick={() => void revoke(member)}
                className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white/75 disabled:opacity-60"
              >
                {revokingId === member.id ? "Removendo…" : "Remover acesso"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
