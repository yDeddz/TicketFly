"use client";

import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SpecialText } from "@/components/ui/special-text";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "signup" | "forgot";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authError = searchParams.get("error");
    if (authError) {
      setError(authError);
    }
  }, [searchParams]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setLoading(false);
      setError("Configure o Supabase para autenticar.");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (mode === "forgot") {
      const normalized = email.trim().toLowerCase();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalized);

      setLoading(false);

      if (resetError) {
        setError(resetError.message);
        return;
      }

      sessionStorage.setItem("ticketfly_reset_email", normalized);
      router.push(`/redefinir-senha?email=${encodeURIComponent(normalized)}`);
      return;
    }

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (signInError) {
        setError(signInError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : signInError.message);
        return;
      }

      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, name },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }

    setMessage("Conta criada. Confirme o e-mail se necessário e faça login.");
    setMode("login");
  }

  const title =
    mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Esqueci a senha";
  const subtitle =
    mode === "login"
      ? "Use e-mail e senha para acessar ingressos e o painel."
      : mode === "signup"
        ? "Cadastre-se com e-mail e senha em poucos segundos."
        : "Informe seu e-mail e enviaremos um código de 8 dígitos para criar uma nova senha.";

  return (
    <form
      onSubmit={submit}
      className="glass-panel relative mx-auto grid w-full max-w-md gap-5 overflow-hidden rounded-2xl border border-white/10 p-6 shadow-[0_24px_80px_-40px_rgba(255,20,147,0.55)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(255,20,147,0.28),transparent_70%)]"
      />

      <div className="relative">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#ff1493]">
          <Sparkles className="h-4 w-4" />
          Acesso TicketFly
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-white/58">{subtitle}</p>
      </div>

      {mode !== "forgot" ? (
        <div className="relative grid grid-cols-2 rounded-full border border-white/10 bg-black/35 p-1 text-sm font-bold">
          <button
            className={`cursor-pointer rounded-full px-4 py-2.5 transition-colors duration-200 ${
              mode === "login" ? "bg-[#ff1493] text-white shadow-[0_8px_24px_-12px_rgba(255,20,147,0.9)]" : "text-white/58 hover:text-white"
            }`}
            onClick={() => switchMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={`cursor-pointer rounded-full px-4 py-2.5 transition-colors duration-200 ${
              mode === "signup" ? "bg-[#ff1493] text-white shadow-[0_8px_24px_-12px_rgba(255,20,147,0.9)]" : "text-white/58 hover:text-white"
            }`}
            onClick={() => switchMode("signup")}
            type="button"
          >
            Cadastro
          </button>
        </div>
      ) : null}

      {mode === "signup" ? (
        <label className="relative grid gap-2 text-sm font-medium text-white/90">
          Nome
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-[#0d0b10] px-3 outline-none transition duration-200 focus:border-[#ff1493]/70 focus:ring-2 focus:ring-[#ff1493]/20"
            placeholder="Seu nome"
            autoComplete="name"
          />
        </label>
      ) : null}

      <label className="relative grid gap-2 text-sm font-medium text-white/90">
        E-mail
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 rounded-xl border border-white/10 bg-[#0d0b10] px-3 outline-none transition duration-200 focus:border-[#ff1493]/70 focus:ring-2 focus:ring-[#ff1493]/20"
          placeholder="voce@email.com"
          autoComplete="email"
        />
      </label>

      {mode !== "forgot" ? (
        <label className="relative grid gap-2 text-sm font-medium text-white/90">
          Senha
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              className="h-12 w-full rounded-xl border border-white/10 bg-[#0d0b10] px-3 pr-12 outline-none transition duration-200 focus:border-[#ff1493]/70 focus:ring-2 focus:ring-[#ff1493]/20"
              placeholder="Mínimo 6 caracteres"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-white/55 transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
      ) : null}

      {mode === "login" ? (
        <div className="relative -mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            className="cursor-pointer text-sm font-semibold text-[#ff1493] transition-colors duration-200 hover:text-[#ffb1d5]"
          >
            Esqueci a senha
          </button>
        </div>
      ) : null}

      <button
        disabled={loading}
        className="neon-button flex min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-black transition duration-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === "login" ? (
          <LogIn className="h-4 w-4" />
        ) : mode === "signup" ? (
          <UserPlus className="h-4 w-4" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar código"}
      </button>

      {mode === "forgot" ? (
        <button
          type="button"
          onClick={() => switchMode("login")}
          className="cursor-pointer text-center text-sm font-semibold text-white/60 transition-colors duration-200 hover:text-white"
        >
          Voltar ao login
        </button>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-[#ff1493]/25 bg-[#ff1493]/10 p-3 text-sm text-[#ffb1d5]">{message}</p>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-white/48">
        {mode === "login" ? (
          <LockKeyhole className="h-4 w-4 text-[#ff1493]" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-[#ff1493]" />
        )}
        {mode === "forgot"
          ? "O código expira em poucos minutos. Digite-o na próxima tela com a nova senha."
          : "Acesso com e-mail e senha. Sessão mantida no navegador."}
      </p>

      <div className="relative flex justify-center border-t border-white/8 pt-4">
        <SpecialText
          delay={0.35}
          speed={18}
          className="h-auto text-center text-sm font-semibold tracking-wide text-[#ff9ed2] sm:text-base"
        >
          Voe mais alto. Viva Experiências
        </SpecialText>
      </div>
    </form>
  );
}
