import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="ticket-grid px-4 pb-16 pt-8">
      <section className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-6xl gap-8 md:grid-cols-[1fr_460px] md:items-center">
        <div>
          <p className="text-sm font-black uppercase text-[#ff1493]">TicketFly ID</p>
          <h1 className="mt-4 text-5xl font-black leading-none md:text-7xl">
            Redefina sua senha com segurança.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/62">
            Depois de clicar no link do e-mail, escolha uma senha nova e volte a acessar ingressos e
            painéis.
          </p>
        </div>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
