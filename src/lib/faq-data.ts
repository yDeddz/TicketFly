import type { FAQCategories, FAQData } from "@/components/ui/faq-tabs";

export const faqCategories: FAQCategories = {
  "comprar-ingressos": "Comprar Ingressos",
  "meus-ingressos": "Meus Ingressos",
  pagamentos: "Pagamentos e Reembolsos",
  seguranca: "Segurança da Compra",
  "criar-eventos": "Criar Eventos",
  "vender-ingressos": "Vender Ingressos",
  checkin: "Check-in e Acesso",
  organizadores: "Organizadores",
  alteracoes: "Alterações e Transferências",
  conta: "Conta e Suporte",
};

export const faqData: FAQData = {
  "comprar-ingressos": [
    {
      question: "Como comprar ingressos online pela TicketFly?",
      answer:
        "Acesse a página do evento, escolha o lote desejado, opcionalmente adicione a Proteção de Compra e um cupom, e finalize no checkout seguro do Mercado Pago. Após a confirmação do pagamento, seu ingresso digital fica disponível no painel e no link enviado por e-mail.",
    },
    {
      question: "Como encontrar meus ingressos após a compra?",
      answer:
        "Entre na sua conta TicketFly e abra Meus Ingressos em /painel. Lá você vê o histórico, o status e o QR Code de cada ingresso pago. Também pode usar o link individual enviado após a aprovação do pagamento.",
    },
    {
      question: "Posso comprar ingressos pelo celular?",
      answer:
        "Sim. A TicketFly é responsiva: você navega pelos eventos, conclui o pagamento e apresenta o QR Code direto pelo navegador do celular, sem precisar de aplicativo.",
    },
    {
      question: "É seguro comprar ingressos na TicketFly?",
      answer:
        "Sim. O pagamento é processado pelo Mercado Pago, os ingressos são digitais com QR Code único e a plataforma registra cada compra com status de pagamento e validação na entrada.",
    },
    {
      question: "Posso comprar mais de um ingresso na mesma compra?",
      answer:
        "Cada checkout gera um ingresso por vez. Para levar mais pessoas, repita a compra no mesmo evento (ou em lotes diferentes) quantas vezes precisar — todos os ingressos ficam reunidos no seu painel.",
    },
  ],
  "meus-ingressos": [
    {
      question: "Onde ficam meus ingressos comprados?",
      answer:
        "Em Meus Ingressos (/painel), após entrar com a conta usada na compra. Cada item mostra evento, lote, status e acesso ao QR Code.",
    },
    {
      question: "Como baixar meu ingresso em PDF?",
      answer:
        "O ingresso TicketFly é digital. Abra a página do ingresso no celular ou no computador e, se quiser uma cópia impressa, use a impressão do navegador (Salvar como PDF). O QR Code na tela já é válido na porta.",
    },
    {
      question: "Posso apresentar o ingresso pelo celular?",
      answer:
        "Sim — é o formato recomendado. Abra o ingresso no painel ou pelo link recebido e mostre o QR Code na entrada. Mantenha o brilho da tela alto para facilitar a leitura.",
    },
    {
      question: "Perdi o e-mail da compra. Como recuperar meu ingresso?",
      answer:
        "Faça login com o mesmo e-mail da compra e acesse /painel. Se ainda não tiver conta, crie uma com esse e-mail: os ingressos pagos vinculados a ele passam a aparecer automaticamente.",
    },
    {
      question: "Como verificar se meu ingresso é válido?",
      answer:
        "No painel ou na página do ingresso, confira se o status está como pago (não cancelado nem já utilizado). Na porta, a validação oficial é feita pelo check-in da TicketFly ao escanear o QR Code.",
    },
  ],
  pagamentos: [
    {
      question: "Quais formas de pagamento a TicketFly aceita?",
      answer:
        "Aceitamos as formas disponibilizadas no checkout do Mercado Pago, como Pix, cartão de crédito e outras opções exibidas no momento do pagamento, conforme disponibilidade da sua região.",
    },
    {
      question: "O pagamento foi aprovado, mas não recebi meu ingresso. O que fazer?",
      answer:
        "Aguarde alguns minutos e atualize Meus Ingressos. Se o Mercado Pago já confirmou e o ingresso ainda não aparece, confira o e-mail da compra, o spam e o status em /status da compra. Persistindo o problema, fale com o suporte informando o e-mail e o comprovante.",
    },
    {
      question: "Como solicitar o reembolso de um ingresso?",
      answer:
        "A política depende do evento e das regras do organizador. Em geral, solicitações passam pelo organizador ou pela operação TicketFly. Se você contratou a Proteção de Compra, use os casos cobertos pelo seguro. Cancelamentos e reembolsos aprovados refletem no status do ingresso.",
    },
    {
      question: "Quanto tempo leva para o pagamento ser confirmado?",
      answer:
        "Pix costuma confirmar em segundos ou poucos minutos. Cartão pode levar um pouco mais, conforme a análise do Mercado Pago. Assim que o pagamento for aprovado, o ingresso é liberado automaticamente.",
    },
    {
      question: "Posso cancelar minha compra?",
      answer:
        "Depende da política do evento e se o ingresso já foi usado no check-in. Com Proteção de Compra, imprevistos cobertos podem gerar reembolso. Sem seguro, o cancelamento fica a critério do organizador e das regras do evento.",
    },
  ],
  seguranca: [
    {
      question: "Os ingressos da TicketFly são seguros?",
      answer:
        "Sim. Cada ingresso tem código e QR Code únicos, vinculados ao pagamento confirmado. Na entrada, o check-in marca o uso e impede reutilização indevida.",
    },
    {
      question: "Como funciona o QR Code do ingresso?",
      answer:
        "O QR Code identifica o seu ingresso na validação. A equipe do evento escaneia na porta; se estiver pago e ainda não utilizado, a entrada é liberada. Após o check-in, o mesmo código não vale novamente.",
    },
    {
      question: "O que é o Seguro Compra Protegida?",
      answer:
        "É a Proteção de Compra opcional no checkout. Cobre imprevistos como doença/COVID-19, acidente pessoal, furto de documentos, falha no transporte público, óbito de familiar e compromisso profissional ou judicial, conforme as condições do seguro.",
    },
    {
      question: "Como evitar golpes na compra de ingressos?",
      answer:
        "Compre apenas pela TicketFly ou por links oficiais do organizador. Desconfie de QR Codes enviados por redes sociais, preços muito abaixo do lote e transferências diretas. Seu ingresso válido aparece no painel após pagamento aprovado.",
    },
    {
      question: "A TicketFly protege meus dados pessoais?",
      answer:
        "Sim. Usamos autenticação segura, dados de pagamento ficam com o Mercado Pago e as informações da conta e dos ingressos são tratadas para operar a compra, o acesso ao evento e o suporte.",
    },
  ],
  "criar-eventos": [
    {
      question: "Como criar um evento na TicketFly?",
      answer:
        "Candidate-se em /parceiros. Após a aprovação do contrato de parceria, você acessa o painel do organizador e cadastra o evento com data, local, lotes e configurações de venda.",
    },
    {
      question: "Quanto custa publicar um evento?",
      answer:
        "Não há cobrança fixa para publicar. A TicketFly trabalha com taxa de serviço sobre as vendas, com faixas e participação negociáveis no contrato do parceiro.",
    },
    {
      question: "Posso criar eventos gratuitos e pagos?",
      answer:
        "Sim. Você define lotes com preço zero (gratuito) ou valores pagos. Em ambos os casos, o ingresso digital e o check-in por QR Code continuam disponíveis.",
    },
    {
      question: "Quanto tempo leva para publicar um evento?",
      answer:
        "Depois da parceria aprovada, o cadastro no painel é rápido. A publicação depende do preenchimento completo (data, local, lotes) e da liberação do status do evento pela operação.",
    },
    {
      question: "Quais tipos de eventos posso cadastrar?",
      answer:
        "Shows, festas, festivais, esportes, teatros e outras experiências presenciais que vendam ou controlem acesso por ingresso digital.",
    },
  ],
  "vender-ingressos": [
    {
      question: "Como vender ingressos online pela TicketFly?",
      answer:
        "Com o evento publicado, compartilhe a página pública. Os compradores pagam no Mercado Pago e recebem o ingresso digital. Você acompanha vendas, cupons e check-in no painel do organizador.",
    },
    {
      question: "Posso criar diferentes lotes de ingressos?",
      answer:
        "Sim. Crie lotes como Pista, VIP ou Camarote, cada um com nome, preço e quantidade. Controle estoque, reservas e vendas direto no painel.",
    },
    {
      question: "É possível criar cupons de desconto?",
      answer:
        "Sim. No painel do organizador você cria cupons com regras de desconto. O comprador aplica o código no checkout antes de ir ao Mercado Pago.",
    },
    {
      question: "Como acompanhar as vendas em tempo real?",
      answer:
        "No painel do organizador você vê ingressos vendidos, reservas, pagamentos e relatórios. Também é possível integrar webhooks para receber eventos de venda no seu sistema.",
    },
    {
      question: "Como funciona a taxa da TicketFly?",
      answer:
        "Há uma taxa de serviço sobre o valor do ingresso, com percentuais por faixa de preço definidos no contrato. Parte dessa taxa pode ser compartilhada com o parceiro, conforme a negociação.",
    },
  ],
  checkin: [
    {
      question: "Como funciona o check-in digital?",
      answer:
        "A equipe acessa /checkin, seleciona o evento e valida o ingresso pela câmera (QR Code) ou pelo código manual. O sistema confirma se está pago, se já foi usado ou se foi cancelado.",
    },
    {
      question: "Preciso imprimir meu ingresso?",
      answer:
        "Não. O celular é suficiente. Se preferir, você pode imprimir a página do ingresso, mas a validação oficial é o QR Code digital.",
    },
    {
      question: "O QR Code pode ser usado mais de uma vez?",
      answer:
        "Não. Após um check-in válido, o ingresso fica marcado como utilizado e novas tentativas retornam como já usado.",
    },
    {
      question: "Como validar ingressos na entrada do evento?",
      answer:
        "Use o check-in TicketFly com login de organizador/operação: escaneie o QR ou digite o código do ingresso. O resultado aparece na hora (válido, já usado, cancelado, não pago ou não encontrado).",
    },
    {
      question: "O aplicativo de check-in funciona offline?",
      answer:
        "O check-in precisa de conexão com a internet para validar o ingresso nos servidores da TicketFly e evitar entrada duplicada. Garanta Wi-Fi ou dados móveis estáveis na porta.",
    },
  ],
  organizadores: [
    {
      question: "Como acessar o painel do organizador?",
      answer:
        "Com a parceria aprovada, entre na sua conta TicketFly e acesse /organizador. Lá ficam eventos, ingressos, cupons, promotores, pagamentos e reembolsos.",
    },
    {
      question: "Como editar um evento já publicado?",
      answer:
        "Abra o evento no painel do organizador e atualize as informações permitidas. Algumas alterações sensíveis (data, status ou regras comerciais) podem exigir alinhamento com a operação TicketFly.",
    },
    {
      question: "Posso adicionar colaboradores ao evento?",
      answer:
        "Sim. Você pode cadastrar promotores com código e comissão, e usar a equipe operacional no check-in. Para outros níveis de acesso, fale com o suporte da plataforma.",
    },
    {
      question: "Como visualizar relatórios de vendas?",
      answer:
        "No painel do organizador há visão de vendas, ingressos e pagamentos. Também é possível exportar dados e acompanhar o financeiro vinculado ao Mercado Pago conectado.",
    },
    {
      question: "Quando recebo o repasse das vendas?",
      answer:
        "O valor líquido do ingresso segue para a conta Mercado Pago do organizador conforme a liquidação do provedor. A taxa de serviço é tratada à parte, de acordo com o contrato de parceria.",
    },
  ],
  alteracoes: [
    {
      question: "Posso transferir meu ingresso para outra pessoa?",
      answer:
        "A transferência nominal depende da política do evento. Em muitos casos o QR Code digital já serve para quem for entrar. Se precisar alterar o nome no comprovante, fale com o organizador ou o suporte.",
    },
    {
      question: "Como alterar os dados do participante?",
      answer:
        "Dados coletados no Mercado Pago e no ingresso ficam vinculados à compra. Para correções (nome ou e-mail), entre em contato com o suporte com o comprovante da compra.",
    },
    {
      question: "O organizador pode alterar a data do evento?",
      answer:
        "Sim, o organizador pode remarcar e comunicar o público. Seus ingressos costumam permanecer válidos para a nova data, salvo cancelamento ou regras específicas do evento.",
    },
    {
      question: "O que acontece se o evento for cancelado?",
      answer:
        "Em cancelamento, o organizador e a TicketFly orientam o fluxo de reembolso ou remarcação. Ingressos cancelados deixam de ser válidos no check-in e o status é atualizado no painel.",
    },
    {
      question: "Posso trocar meu ingresso por outro lote?",
      answer:
        "A troca de lote não é automática. Verifique com o organizador se há upgrade disponível; caso contrário, a solução costuma ser reembolso (quando permitido) e nova compra no lote desejado.",
    },
  ],
  conta: [
    {
      question: "Como criar uma conta na TicketFly?",
      answer:
        "Acesse /login e cadastre-se com e-mail. Use o mesmo e-mail das compras para ver automaticamente seus ingressos em Meus Ingressos.",
    },
    {
      question: "Esqueci minha senha. Como recuperar?",
      answer:
        "Na tela de login, solicite a redefinição de senha. Você receberá um e-mail com o link para criar uma nova senha em /redefinir-senha.",
    },
    {
      question: "Como alterar meu e-mail cadastrado?",
      answer:
        "Por segurança, a troca de e-mail é tratada pelo suporte. Entre em contato informando o e-mail atual e o novo, e aguarde a confirmação antes de novas compras.",
    },
    {
      question: "Como entrar em contato com o suporte?",
      answer:
        "Use os canais oficiais da TicketFly (redes e contato indicados no site) e informe e-mail da compra, código do ingresso ou comprovante do Mercado Pago para agilizar o atendimento.",
    },
    {
      question: "Como excluir minha conta da TicketFly?",
      answer:
        "Solicite a exclusão pelo suporte. Contas com eventos ativos, saldos ou ingressos futuros podem precisar de etapas extras antes da remoção definitiva dos dados.",
    },
  ],
};
