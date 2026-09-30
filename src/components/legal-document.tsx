import type { ReactNode } from "react";
import Link from "next/link";

import { GlowingEffect } from "@/components/ui/glowing-effect";

export const SUPPORT_EMAIL = "suporte@ticketfly.app";

export function LegalDocument({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="ticket-grid min-h-[70vh] px-4 pb-20 pt-10 sm:px-5 sm:pt-14 lg:px-6">
      <article className="mx-auto grid max-w-3xl gap-8">
        <header>
          <p className="bg-gradient-to-r from-[#ff1493] to-[#ff7ec8] bg-clip-text text-sm font-semibold uppercase tracking-[0.18em] text-transparent">
            {kicker}
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">{lede}</p>
        </header>
        <div className="grid gap-7 text-sm leading-6 text-white/60">{children}</div>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-base font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

export function WithdrawalCallout() {
  return (
    <div className="relative rounded-[1.25rem] border border-white/[0.08] p-2">
      <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
      <div className="relative rounded-xl border border-[#ff1493]/40 bg-[#ff1493]/10 p-4 text-sm leading-6 text-white sm:p-5">
        <h2 className="text-base font-black">Direito de arrependimento — CDC art. 49</h2>
        <p className="mt-2 text-white/90">
          Você pode desistir da compra em 7 dias corridos, contados da aprovação do pagamento, se as três
          condições abaixo forem verdadeiras ao mesmo tempo: o ingresso ainda não teve check-in, o pedido chega
          dentro desses 7 dias, e o evento começa somente depois do fim dessa janela.
        </p>
        <p className="mt-2 text-white/90">
          Nesse caso devolvemos só o valor do ingresso. A taxa de serviço não volta. A Proteção de Compra também não
          volta: quem vende essa proteção é a TicketFly, e o valor dela fica com a TicketFly. Envie o e-mail da compra
          e o código do ingresso para{" "}
          <a className="font-semibold text-white underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="mt-2 text-xs leading-5 text-white/75">
          Evento que começa dentro desses 7 dias, ingresso já utilizado ou pedido fora do prazo não entram neste
          direito. O restante segue a página de reembolso.
        </p>
      </div>
    </div>
  );
}

export function LegalCrosslinks() {
  return (
    <p className="text-xs leading-5 text-white/45">
      <Link className="hover:text-white" href="/termos">
        Termos de Uso
      </Link>
      {" · "}
      <Link className="hover:text-white" href="/privacidade">
        Privacidade
      </Link>
      {" · "}
      <Link className="hover:text-white" href="/reembolso">
        Reembolso
      </Link>
      {" · atualizado em 29 de setembro de 2026"}
    </p>
  );
}
