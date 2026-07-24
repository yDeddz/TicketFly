import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="ticket-grid px-4 pb-16 pt-8">
      <section className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-6xl gap-8 md:grid-cols-[1fr_460px] md:items-center">
        <div>
          <p className="text-sm font-black uppercase text-[#ff1493]">TicketFly ID</p>
          <h1 className="mt-4 text-5xl font-black leading-none md:text-7xl">
            Entre no seu universo de eventos.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/62">
            Acesse ingressos, favoritos, compras e beneficios VIP em uma area elegante e segura.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
