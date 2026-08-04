export type PaymentProviderName = "mercado_pago" | "asaas";

export type LocalPaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";

export type CreateCheckoutInput = {
  paymentId: string;
  ticketId: string;
  eventTitle: string;
  amountCents: number;
  ticketPriceCents: number;
  feeCents: number;
  insuranceCents: number;
  netAmountCents: number;
  marketplaceFeeCents: number;
  buyerName: string;
  buyerEmail: string;
  buyerUserEmail?: string | null;
  statusUrl: string;
  metadata: Record<string, unknown>;
  mpAccessToken?: string | null;
  useMpConnect?: boolean;
  asaasWalletId?: string | null;
};

export type CreateCheckoutResult = {
  provider: PaymentProviderName;
  checkoutUrl: string;
  providerPreferenceId?: string | null;
  providerPaymentId?: string | null;
};

export type PaymentProvider = {
  name: PaymentProviderName;
  createCheckout: (input: CreateCheckoutInput) => Promise<CreateCheckoutResult>;
  refund: (providerPaymentId: string) => Promise<boolean>;
};

export type OrganizerPaymentConnection = {
  primary_payment_provider: string | null;
  mp_access_token: string | null;
  mp_connection_status: string | null;
  asaas_wallet_id: string | null;
  asaas_connection_status: string | null;
};
