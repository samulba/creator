import Link from "next/link";
import { Suspense } from "react";

import { Wordmark } from "@/components/ui/wordmark";

import { AuthForm } from "./auth-form";

type AuthMode = "login" | "signup";

const copy: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: "Log in",
    description: "Open your Creator workspace.",
  },
  signup: {
    title: "Create your account",
    description: "Only an email and a password — nothing else yet.",
  },
};

function AuthFormFallback() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-16 rounded-sm bg-raised" />
      <div className="h-16 rounded-sm bg-raised" />
      <div className="h-10 rounded-sm bg-raised" />
    </div>
  );
}

/**
 * Minimal, focused auth surface: a quiet page, not a marketing split screen.
 * Feels like the entry to a desktop creative tool.
 */
export function AuthScreen({
  mode,
  supabaseConfigured,
}: {
  mode: AuthMode;
  supabaseConfigured: boolean;
}) {
  return (
    <main className="flex min-h-screen flex-col px-6 py-5 sm:px-10">
      <header>
        <Link
          href="/"
          className="inline-flex focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Wordmark size="sm" />
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {copy[mode].title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            {copy[mode].description}
          </p>

          {!supabaseConfigured ? (
            <p className="mt-6 border-l-2 border-warn/60 pl-4 text-[13px] leading-5 text-ink-secondary">
              Authentication is not configured in this environment. Add the
              Supabase environment variables to enable{" "}
              {mode === "login" ? "login" : "signup"}.
            </p>
          ) : null}

          <div className="mt-8">
            <Suspense fallback={<AuthFormFallback />}>
              <AuthForm mode={mode} />
            </Suspense>
          </div>
        </div>
      </div>

      <footer className="text-xs text-ink-muted">
        Long-form video production for gaming creators.
      </footer>
    </main>
  );
}
