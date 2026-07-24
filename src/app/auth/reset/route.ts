import { type NextRequest } from "next/server";

import { exchangeCodeAndRedirect } from "@/lib/supabase/auth-callback";

/**
 * Dedicated password-recovery callback.
 * Uses a fixed path (no ?next=) so Supabase cannot drop the destination when
 * appending ?code= to redirectTo.
 */
export async function GET(request: NextRequest) {
  return exchangeCodeAndRedirect(request, {
    next: "/redefinir-senha",
    fallbackNext: "/redefinir-senha",
  });
}
