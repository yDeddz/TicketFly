export const ASAAS_COMPANY_TYPES = ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"] as const;

export type AsaasCompanyType = (typeof ASAAS_COMPANY_TYPES)[number];

export type OrganizerProfileFields = {
  trade_name: string;
  legal_name: string;
  document: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  province: string | null;
  postal_code: string | null;
  birth_date: string | null;
  company_type: string | null;
};

export type OrganizerReceivingFields = {
  pagarme_connection_status?: string | null;
};

export function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function organizerDocumentKind(document: string | null | undefined): "cpf" | "cnpj" | "invalid" {
  const digits = digitsOnly(document);
  if (digits.length === 11) return "cpf";
  if (digits.length === 14) return "cnpj";
  return "invalid";
}

export function isOrganizerProfileComplete(profile: Partial<OrganizerProfileFields>) {
  const kind = organizerDocumentKind(profile.document);
  if (kind === "invalid") return false;
  if (!profile.trade_name?.trim() || !profile.legal_name?.trim()) return false;
  if (digitsOnly(profile.phone).length < 10) return false;
  if (!profile.city?.trim()) return false;
  if (!profile.address?.trim() || !profile.address_number?.trim() || !profile.province?.trim()) return false;
  if (digitsOnly(profile.postal_code).length !== 8) return false;
  if (kind === "cpf" && !profile.birth_date) return false;
  if (kind === "cnpj" && !profile.company_type) return false;
  return true;
}

export function organizerReceivingReady(organizer: OrganizerReceivingFields) {
  return organizer.pagarme_connection_status === "connected";
}

export const ORGANIZER_RECEIVING_NOT_READY_MESSAGE =
  "A TicketFly ainda está liberando o recebimento da casa. Complete o Perfil se faltar algum dado.";

export function connectionStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "connected":
      return "Conectado";
    case "pending":
      return "Pendente";
    case "disconnected":
      return "Desconectado";
    default:
      return status || "Desconectado";
  }
}

export const ORGANIZER_PROFILE_SELECT =
  "id,status,trade_name,legal_name,document,phone,city,address,address_number,complement,province,postal_code,birth_date,company_type,partnership_notes,pagarme_connection_status,primary_payment_provider,fee_threshold_cents,fee_percent_upto_threshold,fee_percent_above_threshold,service_fee_platform_share_percent";
