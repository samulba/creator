import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getOptionalSupabaseConfig } from "./src/lib/supabase/config";

function buildLoginUrl(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);

  if (request.nextUrl.pathname.startsWith("/app")) {
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
  }

  return loginUrl;
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabaseConfig = getOptionalSupabaseConfig();

  if (!supabaseConfig) {
    // Without Supabase configuration there is no session to refresh and no
    // reliable auth state; pages render their own configuration notice.
    return response;
  }

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/app")) {
    return NextResponse.redirect(buildLoginUrl(request));
  }

  if (user && ["/login", "/signup"].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
