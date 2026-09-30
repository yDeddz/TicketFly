import type { Metadata } from "next";
import Link from "next/link";

import { LegalCrosslinks, LegalDocument, LegalSection, SUPPORT_EMAIL, WithdrawalCallout } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Condições de uso da TicketFly, compra de ingressos e Proteção de Compra.",
};

export default function TermosPage() {
  return (
    <LegalDocument
      kicker="TicketFly"
      title="Termos de Uso"
      lede="Estas condições regem a compra de ingressos em www.ticketfly.app. A Proteção de Compra, quando marcada no checkout, segue a página de reembolso e não é apólice de seguradora."
    >
      <WithdrawalCallout />

      <LegalSection title="1. Quem vende o quê">
        <p>
          A TicketFly intermedia a venda do ingresso digital. O organizador produz o evento: data, local, atração,
          idade, regras de entrada e realização. A publicação do evento no site não transfere essa responsabilidade
          para a TicketFly.
        </p>
        <p>
          O contrato de compra se forma quando o pagamento é aprovado. Até lá, a reserva pode expirar e o lote voltar
          ao estoque.
        </p>
      </LegalSection>

      <LegalSection title="2. Ingresso">
        <p>
          Cada ingresso tem código e QR Code únicos, ligados ao nome e ao e-mail informados no checkout. O check-in na
          porta queima o código. O mesmo QR não autoriza segunda entrada.
        </p>
        <p>
          O ingresso é pessoal. Uso por pessoa diferente do comprador registrado, cópia do QR ou apresentação depois do
          check-in não gera novo acesso nem reembolso.
        </p>
      </LegalSection>

      <LegalSection title="3. Preço">
        <p>
          O total do checkout é a soma do valor do ingresso, da taxa de serviço e, se você marcar, da Proteção de
          Compra. A Proteção custa R$ 4,99 quando o ingresso é de até R$ 120,00 e R$ 8,99 quando o ingresso passa desse
          valor. Ela é opcional. O checkout deixa explícito que não se trata de apólice de seguradora.
        </p>
        <p>
          Sem a Proteção marcada na compra, não há reembolso por desistência, mudança de planos, no-show, atraso,
          trânsito, clima ou insatisfação. A lista do que a Proteção cobre, os comprovantes e o que volta em cada caso
          estão em{" "}
          <Link className="font-semibold text-[#ff9ed2] hover:text-white" href="/reembolso">
            Reembolso
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="4. Cancelamento do evento">
        <p>
          Se o organizador cancelar o evento, a devolução do ingresso segue o fluxo interno da TicketFly e do
          organizador. Esse fluxo não se confunde com desistência do comprador nem com pedido de Proteção de Compra.
        </p>
      </LegalSection>

      <LegalSection title="5. Chargeback e fraude">
        <p>
          Contestação do pagamento no banco ou no provedor, dado falso no checkout ou indício de fraude autorizam a
          TicketFly a cancelar o ingresso. Ingresso cancelado não passa no check-in.
        </p>
      </LegalSection>

      <LegalSection title="6. Conta e lei">
        <p>
          O tratamento de dados pessoais está na{" "}
          <Link className="font-semibold text-[#ff9ed2] hover:text-white" href="/privacidade">
            Privacidade
          </Link>
          . Dúvidas sobre estas condições:{" "}
          <a className="font-semibold text-[#ff9ed2] hover:text-white" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . Aplica-se a lei brasileira, inclusive o Código de Defesa do Consumidor. Cláusula que renuncie direito
          irrenunciável do consumidor não produz efeito.
        </p>
      </LegalSection>

      <LegalCrosslinks />
    </LegalDocument>
  );
}
