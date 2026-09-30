import type { Metadata } from "next";
import Link from "next/link";

import { LegalCrosslinks, LegalDocument, LegalSection, SUPPORT_EMAIL, WithdrawalCallout } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Reembolso",
  description: "Regras de reembolso da TicketFly e comprovantes da Proteção de Compra.",
};

export default function ReembolsoPage() {
  return (
    <LegalDocument
      kicker="Proteção de Compra"
      title="Reembolso"
      lede="Não existe pedido automático no site. A análise é humana, feita pela TicketFly, pelo e-mail abaixo. A Proteção de Compra é opcional no checkout e não é apólice de seguradora."
    >
      <WithdrawalCallout />

      <LegalSection title="1. Canal, prazo e tentativas">
        <p>
          Canal único:{" "}
          <a className="font-semibold text-[#ff9ed2] hover:text-white" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . No e-mail: nome igual ao da compra, e-mail do checkout, código do ingresso, qual caso da lista e os
          anexos. Uma solicitação por ingresso.
        </p>
        <p>
          O pedido da Proteção só entra se chegar até 48 horas antes do início do evento e, no máximo, 5 dias corridos
          depois do fato coberto — vale o que ocorrer primeiro. Fora disso, o pedido é negado.
        </p>
        <p>
          Comprovante incompleto: a TicketFly pede o que falta uma vez e dá 48 horas. Sem resposta nesse prazo, o
          pedido é negado. Não permanece em análise. Depois da negativa, cabe uma reanálise, em 48 horas, somente se
          vier documento novo. Sem documento novo, a reanálise é negada. A decisão da TicketFly encerra o pedido na
          plataforma.
        </p>
        <p>
          Check-in feito, ingresso usado, comprador diferente do nome e do e-mail da compra, ou pedido depois do início
          do evento: negado, sem complemento.
        </p>
      </LegalSection>

      <LegalSection title="2. Sem Proteção de Compra">
        <p>
          Se a Proteção não foi marcada no checkout, o e-mail não entra em análise de imprevisto. Não há reembolso por
          desistência, mudança de planos, no-show, atraso, trânsito, carro, aplicativo, clima ou “não gostei”. O
          arrependimento do art. 49 e o cancelamento do evento pelo organizador continuam nos itens próprios desta
          página.
        </p>
      </LegalSection>

      <LegalSection title="3. Lista fechada">
        <p>
          Com a Proteção contratada, o reembolso só existe se o caso estiver nesta lista e o comprovante for aceito. O
          que não está escrito não cobre.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Doença / COVID-19</li>
          <li>Acidente pessoal</li>
          <li>Furto de documentos</li>
          <li>Falha no transporte público</li>
          <li>Óbito de familiar</li>
          <li>Compromisso profissional / judicial</li>
        </ul>
        <p>
          Todo comprovante precisa ser legível, com data, com o nome do comprador igual ao da compra e com nexo direto
          com a impossibilidade de ir àquele evento. Falta qualquer um desses pontos: negado.
        </p>
      </LegalSection>

      <LegalSection title="4. O que provar em cada caso">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            <strong className="font-semibold text-white/80">Doença / COVID-19.</strong> Atestado ou relatório com nome
            do comprador, data, CRM do emissor e impedimento na data do evento. Teste positivo sozinho não basta.
          </li>
          <li>
            <strong className="font-semibold text-white/80">Acidente pessoal.</strong> Boletim de ocorrência ou
            relatório de pronto-socorro com data, nome do comprador e impedimento de comparecer.
          </li>
          <li>
            <strong className="font-semibold text-white/80">Furto de documentos.</strong> Boletim de ocorrência anterior
            ao evento, em nome do comprador, descrevendo o documento exigido na porta.
          </li>
          <li>
            <strong className="font-semibold text-white/80">Falha no transporte público.</strong> Comunicado ou
            protocolo da operadora, com data e hora da interrupção da linha do trajeto. Trânsito, chuva e aplicativo não
            entram.
          </li>
          <li>
            <strong className="font-semibold text-white/80">Óbito de familiar.</strong> Certidão de óbito e prova de
            parentesco. Familiar, nesta página, é cônjuge, companheiro, pais, filhos ou irmãos.
          </li>
          <li>
            <strong className="font-semibold text-white/80">Compromisso profissional / judicial.</strong> Intimação,
            convocação, ou declaração do empregador em papel timbrado com CNPJ, no horário do evento. Reunião marcada
            pelo próprio comprador não cobre.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. O que volta">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            <strong className="font-semibold text-white/80">Proteção aceita.</strong> Só o valor do ingresso. O valor
            pago pela Proteção não volta: o pedido usou o que foi contratado. A taxa de serviço não volta.
          </li>
          <li>
            <strong className="font-semibold text-white/80">Proteção negada.</strong> Nada volta, inclusive o valor da
            Proteção.
          </li>
          <li>
            <strong className="font-semibold text-white/80">Art. 49.</strong> Ingresso, taxa de serviço e Proteção, se
            houver, nas condições do bloco acima.
          </li>
          <li>
            <strong className="font-semibold text-white/80">Evento cancelado pelo organizador.</strong> Devolução do
            ingresso por esse fluxo, já operado pela TicketFly e pelo organizador. Não é pedido de Proteção e não é
            desistência do comprador. Não abra este e-mail para substituir esse cancelamento.
          </li>
        </ul>
        <p>
          O organizador não aprova Proteção de Compra. Não há estorno automático. Preço da Proteção: R$ 4,99 em
          ingresso de até R$ 120,00 e R$ 8,99 acima disso, como no checkout.
        </p>
      </LegalSection>

      <LegalSection title="6. Onde isso também está">
        <p>
          O resumo da compra está nos{" "}
          <Link className="font-semibold text-[#ff9ed2] hover:text-white" href="/termos">
            Termos de Uso
          </Link>
          . Dados do pedido de reembolso seguem a{" "}
          <Link className="font-semibold text-[#ff9ed2] hover:text-white" href="/privacidade">
            Privacidade
          </Link>
          .
        </p>
      </LegalSection>

      <LegalCrosslinks />
    </LegalDocument>
  );
}
