"use client";

import { Eye, EyeOff, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setReady(true);
      setError("Configure o Supabase para autenticar.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setReady(true);
      }
    });

    async function establishRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;

        url.searchParams.delete("code");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

        if (exchangeError) {
          setError("Link inválido ou expirado. Solicite um novo.");
          setReady(true);
          return;
        }

        setHasSession(true);
        setReady(true);
        return;
      }

      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (accessToken && refreshToken && type === "recovery") {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!active) return;

        window.history.replaceState({}, "", url.pathname + url.search);

        if (sessionError) {
          setError("Link inválido ou expirado. Solicite um novo.");
          setReady(true);
          return;
        }

        setHasSession(true);
        setReady(true);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;

      if (session) {
        setHasSession(true);
      }
      setReady(true);
    }

    void establishRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Senha atualizada. Redirecionando…");
    router.replace("/");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="glass-panel mx-auto grid w-full max-w-md place-items-center gap-3 rounded-2xl border border-white/10 p-8">
        <Loader2 className="h-5 w-5 animate-spin text-[#ff1493]" />
        <p className="text-sm text-white/60">Validando link de recuperação…</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="glass-panel mx-auto grid w-full max-w-md gap-4 rounded-2xl border border-white/10 p-6">
        <h1 className="text-2xl font-black text-white">Link inválido ou expirado</h1>
        <p className="text-sm leading-6 text-white/60">
          Solicite um novo e-mail de redefinição de senha para continuar.
        </p>
        <Link
          href="/login"
          className="neon-button inline-flex min-h-[3rem] items-center justify-center rounded-full px-4 text-center text-sm font-black"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

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
          Recuperação
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Nova senha</h1>
        <p className="mt-2 text-sm leading-6 text-white/58">
          Escolha uma senha nova para acessar sua conta TicketFly.
        </p>
      </div>

      <label className="relative grid gap-2 text-sm font-medium text-white/90">
        Nova senha
        <div className="relative">
          <input
            required
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            className="h-12 w-full rounded-xl border border-white/10 bg-[#0d0b10] px-3 pr-12 outline-none transition duration-200 focus:border-[#ff1493]/70 focus:ring-2 focus:ring-[#ff1493]/20"
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
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

      <label className="relative grid gap-2 text-sm font-medium text-white/90">
        Confirmar senha
        <input
          required
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={6}
          className="h-12 rounded-xl border border-white/10 bg-[#0d0b10] px-3 outline-none transition duration-200 focus:border-[#ff1493]/70 focus:ring-2 focus:ring-[#ff1493]/20"
          placeholder="Repita a nova senha"
          autoComplete="new-password"
        />
      </label>

      <button
        disabled={loading}
        className="neon-button flex min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-black transition duration-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
        Salvar nova senha
      </button>

      {error ? (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-[#ff1493]/25 bg-[#ff1493]/10 p-3 text-sm text-[#ffb1d5]">{message}</p>
      ) : null}
    </form>
  );
}
