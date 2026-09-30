import type { Metadata } from "next";
import Link from "next/link";

import { LegalCrosslinks, LegalDocument, LegalSection, SUPPORT_EMAIL } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como a TicketFly trata dados pessoais na compra de ingressos, conforme a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <LegalDocument
      kicker="LGPD"
      title="Privacidade"
      lede="A TicketFly, operadora de www.ticketfly.app, é a controladora dos dados pessoais tratados nesta plataforma."
    >
      <LegalSection title="1. Dados que coletamos">
        <p>Na compra e na conta usamos o que o checkout e o login pedem:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>nome e e-mail do comprador;</li>
          <li>CPF informado no checkout;</li>
          <li>ingresso, lote, evento, valor, status do pagamento e do check-in;</li>
          <li>se a Proteção de Compra foi marcada e o valor correspondente.</li>
        </ul>
        <p>
          Dados de cartão não ficam na TicketFly. Pix e cartão são processados pelo provedor exibido no pagamento
          (Mercado Pago, Pagar.me ou Asaas). A sessão de login usa o Supabase.
        </p>
      </LegalSection>

      <LegalSection title="2. Para que usamos">
        <ul className="list-disc space-y-1 pl-4">
          <li>concluir a venda e emitir o ingresso digital;</li>
          <li>validar a entrada no evento;</li>
          <li>responder suporte e pedidos descritos em Reembolso;</li>
          <li>cumprir obrigação legal e apurar fraude ou chargeback.</li>
        </ul>
        <p>Não vendemos cadastro. Não há ferramenta de analytics descrita aqui além da sessão necessária para entrar na conta.</p>
      </LegalSection>

      <LegalSection title="3. Com quem compartilhamos">
        <p>
          O organizador do evento recebe os dados necessários para operar a lista, o check-in e o repasse da venda. O
          provedor de pagamento recebe o necessário para cobrar. O envio do ingresso por e-mail usa o serviço de e-mail
          da plataforma. Autoridade pública recebe dado quando a lei exigir.
        </p>
      </LegalSection>

      <LegalSection title="4. Prazo">
        <p>
          Guardamos a conta e os ingressos enquanto a compra precisar ser comprovada, inclusive prazos fiscais e de
          disputa de pagamento. Depois disso, o dado é eliminado ou anonimizado, salvo o que a lei mandar conservar.
        </p>
      </LegalSection>

      <LegalSection title="5. Seus direitos">
        <p>
          Confirmação, acesso, correção, anonimização, portabilidade, informação sobre compartilhamento e eliminação do
          que não for obrigatório por lei: um e-mail para{" "}
          <a className="font-semibold text-[#ff9ed2] hover:text-white" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          , pelo endereço usado na compra ou na conta. A TicketFly responde o pedido de titular. Eliminação não apaga
          ingresso já usado nem registro que a lei mande guardar.
        </p>
        <p>
          Regras de compra e de devolução estão nos{" "}
          <Link className="font-semibold text-[#ff9ed2] hover:text-white" href="/termos">
            Termos de Uso
          </Link>{" "}
          e em{" "}
          <Link className="font-semibold text-[#ff9ed2] hover:text-white" href="/reembolso">
            Reembolso
          </Link>
          .
        </p>
      </LegalSection>

      <LegalCrosslinks />
    </LegalDocument>
  );
}
