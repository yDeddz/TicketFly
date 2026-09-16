import { createAdminClient } from "@/lib/supabase/admin";

import {
  AsaasRequestError,
  asaasAccountStatus,
  asaasCreateSubaccount,
  asaasFindAccountByCpfCnpj,
  asaasGetAccount,
  type AsaasSubaccount,
} from "./asaas-client";

export async function resolveAsaasAccount(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string;
  companyType?: string;
  phone?: string;
  mobilePhone: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
}): Promise<AsaasSubaccount> {
  const existing = await asaasFindAccountByCpfCnpj(input.cpfCnpj).catch(() => null);
  if (existing?.id) {
    if (existing.walletId) return existing;
    return asaasGetAccount(existing.id);
  }

  try {
    return await asaasCreateSubaccount({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      ...(input.birthDate ? { birthDate: input.birthDate } : {}),
      ...(input.companyType ? { companyType: input.companyType } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      mobilePhone: input.mobilePhone,
      address: input.address,
      addressNumber: input.addressNumber,
      ...(input.complement ? { complement: input.complement } : {}),
      province: input.province,
      postalCode: input.postalCode,
    });
  } catch (error) {
    if (error instanceof AsaasRequestError && (error.status === 400 || error.status === 409)) {
      const again = await asaasFindAccountByCpfCnpj(input.cpfCnpj).catch(() => null);
      if (again?.id) {
        return again.walletId ? again : asaasGetAccount(again.id);
      }
    }
    throw error;
  }
}

export async function persistAsaasAccount(
  organizerId: string,
  account: AsaasSubaccount,
  options?: { setPrimary?: boolean },
) {
  if (!account.id || !account.walletId) {
    throw new Error("Asaas account missing walletId/id");
  }
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    asaas_account_id: account.id,
    asaas_wallet_id: account.walletId,
    asaas_connection_status: "connected",
  };
  if (options?.setPrimary !== false) {
    patch.primary_payment_provider = "asaas";
  }
  const { error } = await admin.from("organizers").update(patch).eq("id", organizerId);
  if (error) throw error;

  await admin
    .from("organizers")
    .update({ asaas_account_status: asaasAccountStatus(account) })
    .eq("id", organizerId);
}
