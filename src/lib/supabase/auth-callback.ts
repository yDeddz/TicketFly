import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

function safeNextPath(next: string | null, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}

function resolveOrigin(request: NextRequest) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv || !forwardedHost) {
    return url.origin;
  }

  return `https://${forwardedHost}`;
}

/**
 * Exchanges a PKCE auth code and redirects, writing session cookies onto the
 * redirect response (required — cookieStore alone may not attach to redirects).
 */
export async function exchangeCodeAndRedirect(
  request: NextRequest,
  options: { next?: string | null; fallbackNext?: string } = {},
) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");
  const origin = resolveOrigin(request);
  const next = safeNextPath(
    options.next ?? searchParams.get("next"),
    options.fallbackNext ?? "/",
  );

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Não foi possível validar o link de acesso.")}`,
    );
  }

  let redirectResponse = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          redirectResponse = NextResponse.redirect(`${origin}${next}`);
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            redirectResponse.cookies.set(name, value, cookieOptions);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Link inválido ou expirado. Solicite um novo.")}`,
    );
  }

  return redirectResponse;
}
