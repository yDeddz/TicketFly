const SUPABASE_PT: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha inválidos",
  "Email not confirmed": "Confirme seu e-mail antes de entrar",
  "User already registered": "Este e-mail já está cadastrado",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres",
  "Unable to validate email address: invalid format": "E-mail inválido",
  "For security purposes, you can only request this after": "Aguarde alguns segundos antes de tentar de novo",
  "New password should be different from the old password.": "A nova senha deve ser diferente da atual",
  "Token has expired or is invalid": "Código expirado ou inválido — solicite um novo",
  "Signups not allowed for this instance": "Cadastros estão temporariamente desativados",
};

export function mapAuthErrorMessage(raw: string | null | undefined) {
  if (!raw) return "Não foi possível autenticar";
  const trimmed = raw.trim();
  for (const [en, pt] of Object.entries(SUPABASE_PT)) {
    if (trimmed.includes(en)) return pt;
  }
  if (/rate limit|too many/i.test(trimmed)) return "Muitas tentativas — aguarde um momento";
  if (/network|fetch/i.test(trimmed)) return "Falha de rede — verifique sua conexão";
  return trimmed;
}

export function getErrorMessage(payload: unknown, fallback = "Algo deu errado. Tente novamente.") {
  if (!payload) return fallback;
  if (typeof payload === "string") return mapAuthErrorMessage(payload);

  if (typeof payload === "object") {
    const body = payload as { error?: unknown; message?: unknown; code?: unknown };
    const raw =
      (typeof body.error === "string" && body.error) ||
      (typeof body.message === "string" && body.message) ||
      null;
    if (raw) return mapAuthErrorMessage(raw);
  }

  return fallback;
}

export async function readApiError(response: Response, fallback?: string) {
  const payload = await response.json().catch(() => null);
  return {
    message: getErrorMessage(payload, fallback),
    requestId:
      (payload && typeof payload === "object" && "requestId" in payload
        ? String((payload as { requestId?: string }).requestId ?? "")
        : "") ||
      response.headers.get("x-request-id") ||
      null,
    payload,
  };
}
