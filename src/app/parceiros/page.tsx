import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Handshake,
  ShieldCheck,
  Sparkles,
  Ticket,
  Wallet,
} from "lucide-react";

import { PartnerApplyForm } from "@/components/partner-apply-form";
import { hasSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  let loggedIn = false;
  let alreadyPartner = false;
  let partnerStatus: string | null = null;

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    loggedIn = Boolean(user);

    if (user) {
      const { data: organizer } = await supabase
        .from("organizers")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      alreadyPartner = Boolean(organizer);
      partnerStatus = organizer?.status ?? null;
    }
  }

  return (
    <main className="ticket-grid">
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(105deg, rgba(5,5,5,0.96) 0%, rgba(5,5,5,0.78) 42%, rgba(255,20,147,0.18) 100%), url(https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=2000&q=85)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:px-6 lg:pt-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#ff1493]/35 bg-[#ff1493]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#ff7ec8]">
              <Sparkles className="h-3.5 w-3.5" />
              Parceria TicketFly
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[0.95] text-white md:text-6xl">
              Quero ser parceiro
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/68">
              Para donos de balada e festas que querem vender ingressos online e negociar o recebimento
              de uma fatia da taxa de serviço — o diferencial da TicketFly no mercado.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#candidatura"
                className="neon-button inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-3 text-sm font-black"
              >
                Quero anunciar minha balada
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/organizador"
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/80 transition-colors duration-200 hover:border-[#ff1493]/40 hover:text-white"
              >
                Já sou parceiro
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">Modelo único</p>
            <h2 className="mt-3 text-2xl font-black text-white">Você ganha em cima da taxa</h2>
            <p className="mt-3 text-sm leading-6 text-white/62">
              O cliente paga o ingresso + taxa de serviço. O valor do ingresso vai para a balada. A taxa
              é o motor da plataforma — e com a TicketFly você pode negociar ficar com uma % dessa taxa.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3 lg:px-6">
        <Feature
          icon={<Ticket className="h-5 w-5" />}
          title="Ingresso 100% seu"
          text="O preço do lote é da balada. Transparência total no checkout."
        />
        <Feature
          icon={<BadgePercent className="h-5 w-5" />}
          title="% da taxa negociável"
          text="Contrato sob medida: combine quanto da taxa de serviço volta para você."
        />
        <Feature
          icon={<Wallet className="h-5 w-5" />}
          title="Repasse claro"
          text="Contabilidade separada: líquido da balada e taxa TicketFly, sem surpresa."
        />
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 lg:grid-cols-[0.95fr_1.05fr] lg:px-6">
        <div className="grid content-start gap-5">
          <div className="rounded-2xl border border-white/10 bg-[#111014] p-6">
            <p className="flex items-center gap-2 text-sm font-black uppercase text-[#ff1493]">
              <Handshake className="h-4 w-4" />
              Por que a TicketFly
            </p>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-white/68">
              <li>Checkout rápido com Pix e cartão.</li>
              <li>Taxa em faixas (ex.: 12% até R$120 e 9% acima), ajustável no contrato.</li>
              <li>Painel para eventos, vendas e check-in.</li>
              <li>Diferencial real: negociar participação na taxa de serviço.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[#ff1493]/25 bg-[#ff1493]/8 p-6">
            <p className="flex items-center gap-2 text-sm font-bold text-[#ffb1d5]">
              <ShieldCheck className="h-4 w-4" />
              Aprovação humana
            </p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Cada parceria passa pelo time TicketFly. Você envia os dados da balada; nós avaliamos e
              liberamos o contrato de taxa.
            </p>
          </div>
        </div>

        <div id="candidatura" className="scroll-mt-28">
          {alreadyPartner ? (
            <div className="glass-panel rounded-2xl p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">Status</p>
              <h2 className="mt-2 text-3xl font-black">Você já tem uma candidatura</h2>
              <p className="mt-3 text-white/62">
                Status atual: <strong className="text-white">{partnerStatus}</strong>
              </p>
              <Link
                href="/organizador"
                className="neon-button mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-3 text-sm font-black"
              >
                Abrir painel do organizador
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : !loggedIn ? (
            <div className="glass-panel rounded-2xl p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1493]">Comece agora</p>
              <h2 className="mt-2 text-3xl font-black">Entre para enviar a proposta</h2>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Crie sua conta ou faça login. Em seguida, preencha os dados da balada e diga como quer
                negociar a % da taxa de serviço.
              </p>
              <Link
                href="/login"
                className="neon-button mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-3 text-sm font-black"
              >
                Entrar para ser parceiro
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <PartnerApplyForm />
          )}
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111014] p-5">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#ff1493]/12 text-[#ff1493]">{icon}</div>
      <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/58">{text}</p>
    </div>
  );
}
