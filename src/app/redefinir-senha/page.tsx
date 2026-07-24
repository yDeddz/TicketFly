import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="ticket-grid px-4 pb-16 pt-8">
      <section className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-6xl gap-8 md:grid-cols-[1fr_460px] md:items-center">
        <div>
          <p className="text-sm font-black uppercase text-[#ff1493]">TicketFly ID</p>
          <h1 className="mt-4 text-5xl font-black leading-none md:text-7xl">
            Redefina sua senha com um código.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/62">
            Receba um código de 8 dígitos no e-mail, confirme na tela e escolha uma senha nova — sem
            depender de links que abrem na home.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="glass-panel mx-auto grid w-full max-w-md place-items-center gap-3 rounded-2xl border border-white/10 p-8">
              <div className="h-5 w-5 animate-pulse rounded-full bg-[#ff1493]/50" />
              <p className="text-sm text-white/60">Carregando…</p>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
