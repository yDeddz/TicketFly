import { type NextRequest } from "next/server";

import { exchangeCodeAndRedirect } from "@/lib/supabase/auth-callback";

export async function GET(request: NextRequest) {
  const type = new URL(request.url).searchParams.get("type");

  // Recovery links sometimes land here without ?next= — send them to the form.
  if (type === "recovery") {
    return exchangeCodeAndRedirect(request, {
      next: "/redefinir-senha",
      fallbackNext: "/redefinir-senha",
    });
  }

  return exchangeCodeAndRedirect(request);
}
