"use client";

import { Loader2, Mail, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      window.setTimeout(() => {
        setLoading(false);
        setMessage("Interface pronta. Configure o Supabase para enviar o link magico real.");
      }, 600);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: mode === "signup" ? { name } : undefined,
      },
    });

    setLoading(false);
    setMessage(error ? error.message : "Link de acesso enviado para seu e-mail.");
  }

  return (
    <form onSubmit={submit} className="glass-panel mx-auto grid max-w-md gap-5 rounded-lg p-6">
      <div>
        <p className="flex items-center gap-2 text-xs font-black uppercase text-[#ff1493]">
          <Sparkles className="h-4 w-4" />
          Acesso TicketFly
        </p>
        <h1 className="mt-2 text-3xl font-black">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-2 text-sm text-white/58">Sua area para ingressos, favoritos e compras premium.</p>
      </div>

      <div className="grid grid-cols-2 rounded-full border border-white/10 bg-black/28 p-1 text-sm font-bold">
        <button
          className={`rounded-full px-4 py-2 transition ${mode === "login" ? "bg-[#ff1493] text-white" : "text-white/58 hover:text-white"}`}
          onClick={() => setMode("login")}
          type="button"
        >
          Login
        </button>
        <button
          className={`rounded-full px-4 py-2 transition ${mode === "signup" ? "bg-[#ff1493] text-white" : "text-white/58 hover:text-white"}`}
          onClick={() => setMode("signup")}
          type="button"
        >
          Cadastro
        </button>
      </div>

      {mode === "signup" ? (
        <label className="grid gap-2 text-sm font-medium">
          Nome
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 rounded-lg border border-white/10 px-3 outline-none transition focus:border-[#ff1493]/70"
            placeholder="Seu nome"
          />
        </label>
      ) : null}

      <label className="grid gap-2 text-sm font-medium">
        E-mail
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 rounded-lg border border-white/10 px-3 outline-none transition focus:border-[#ff1493]/70"
          placeholder="voce@email.com"
        />
      </label>

      <button className="neon-button flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-4 font-black">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? <Mail className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {mode === "login" ? "Receber link magico" : "Criar acesso"}
      </button>

      {message ? <p className="rounded-lg border border-[#ff1493]/25 bg-[#ff1493]/10 p-3 text-sm text-[#ffb1d5]">{message}</p> : null}

      <p className="flex items-center gap-2 text-xs text-white/48">
        <ShieldCheck className="h-4 w-4 text-[#ff1493]" />
        Sem senha, com autenticacao por e-mail.
      </p>
    </form>
  );
}
