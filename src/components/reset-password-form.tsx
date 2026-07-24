"use client";

import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Step = "request" | "confirm";

function mapAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  }
  if (
    lower.includes("token") ||
    lower.includes("otp") ||
    lower.includes("expired") ||
    lower.includes("invalid")
  ) {
    return "Código inválido ou expirado. Toque em Reenviar código.";
  }
  if (lower.includes("same password") || lower.includes("should be different")) {
    return "A nova senha precisa ser diferente da atual.";
  }
  return message;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fromQuery = searchParams.get("email")?.trim() ?? "";
    const fromStorage =
      typeof window !== "undefined" ? sessionStorage.getItem("ticketfly_reset_email")?.trim() ?? "" : "";
    const initial = (fromQuery || fromStorage).toLowerCase();

    if (initial) {
      setEmail(initial);
      setStep("confirm");
      setMessage("Digite o código de 8 dígitos do e-mail e escolha a nova senha.");
    }
  }, [searchParams]);

  async function sendCode(targetEmail: string) {
    const supabase = createSupabaseBrowserClient();
    // Sem redirectTo: o fluxo usa OTP ({{ .Token }}) no e-mail, não o link.
    return supabase.auth.resetPasswordForEmail(targetEmail);
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError("Configure o Supabase para autenticar.");
      return;
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await sendCode(normalized);
    setLoading(false);

    if (resetError) {
      setError(mapAuthError(resetError.message));
      return;
    }

    sessionStorage.setItem("ticketfly_reset_email", normalized);
    setEmail(normalized);
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setStep("confirm");
    setMessage("Código enviado. Confira o e-mail e digite os 8 dígitos abaixo.");
  }

  async function resendCode() {
    setError("");
    setMessage("");

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Informe seu e-mail.");
      return;
    }

    setResending(true);
    const { error: resetError } = await sendCode(normalized);
    setResending(false);

    if (resetError) {
      setError(mapAuthError(resetError.message));
      return;
    }

    sessionStorage.setItem("ticketfly_reset_email", normalized);
    setCode("");
    setMessage("Novo código enviado. Confira sua caixa de entrada.");
  }

  async function confirmReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError("Configure o Supabase para autenticar.");
      return;
    }

    const normalized = email.trim().toLowerCase();
    const token = code.replace(/\s/g, "");

    if (!normalized) {
      setError("Informe seu e-mail.");
      return;
    }

    if (!/^\d{8}$/.test(token)) {
      setError("Informe o código de 8 dígitos do e-mail.");
      return;
    }

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

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalized,
      token,
      type: "recovery",
    });

    if (verifyError) {
      setLoading(false);
      setError(mapAuthError(verifyError.message));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(mapAuthError(updateError.message));
      return;
    }

    sessionStorage.removeItem("ticketfly_reset_email");
    setMessage("Senha atualizada. Entrando…");
    router.replace("/");
    router.refresh();
  }

  const panelClass =
    "glass-panel relative mx-auto grid w-full max-w-md gap-5 overflow-hidden rounded-2xl border border-white/10 p-6 shadow-[0_24px_80px_-40px_rgba(255,20,147,0.55)]";

  if (step === "request") {
    return (
      <form onSubmit={requestCode} className={panelClass}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(255,20,147,0.28),transparent_70%)]"
        />

        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#ff1493]">
            <Sparkles className="h-4 w-4" />
            Recuperação
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Esqueci a senha</h1>
          <p className="mt-2 text-sm leading-6 text-white/58">
            Enviaremos um código de 8 dígitos para o seu e-mail.
          </p>
        </div>

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

        <button
          disabled={loading}
          className="neon-button flex min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-black transition duration-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Enviar código
        </button>

        <Link
          href="/login"
          className="cursor-pointer text-center text-sm font-semibold text-white/60 transition-colors duration-200 hover:text-white"
        >
          Voltar ao login
        </Link>

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

  return (
    <form onSubmit={confirmReset} className={panelClass}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(255,20,147,0.28),transparent_70%)]"
      />

      <div className="relative">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#ff1493]">
          <Sparkles className="h-4 w-4" />
          Recuperação
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Código e nova senha</h1>
        <p className="mt-2 text-sm leading-6 text-white/58">
          Digite o código de 8 dígitos do e-mail e defina a nova senha.
        </p>
      </div>

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

      <label className="relative grid gap-2 text-sm font-medium text-white/90">
        Código do e-mail
        <input
          required
          inputMode="numeric"
          autoFocus
          maxLength={8}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
          className="h-14 rounded-xl border border-white/10 bg-[#0d0b10] px-3 text-center text-2xl font-black tracking-[0.35em] outline-none transition duration-200 focus:border-[#ff1493]/70 focus:ring-2 focus:ring-[#ff1493]/20"
          placeholder="00000000"
          autoComplete="one-time-code"
          aria-describedby="reset-code-hint"
        />
        <span id="reset-code-hint" className="text-xs text-white/45">
          Confira a caixa de entrada e o spam. O código expira em poucos minutos.
        </span>
      </label>

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
        disabled={loading || code.length !== 8}
        className="neon-button flex min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-black transition duration-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
        Salvar nova senha
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          disabled={resending || loading}
          onClick={() => void resendCode()}
          className="cursor-pointer font-semibold text-[#ff1493] transition-colors duration-200 hover:text-[#ffb1d5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? "Reenviando…" : "Reenviar código"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setStep("request");
            setCode("");
            setPassword("");
            setConfirmPassword("");
            setError("");
            setMessage("");
          }}
          className="cursor-pointer font-semibold text-white/60 transition-colors duration-200 hover:text-white disabled:opacity-60"
        >
          Trocar e-mail
        </button>
      </div>

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
