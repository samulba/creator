"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { getFriendlyAuthError } from "@/src/lib/auth/errors";
import { getSafeAuthRedirect } from "@/src/lib/auth/redirects";
import { createClient } from "@/src/lib/supabase/client";

type AuthMode = "login" | "signup";

type AuthCardProps = {
  mode: AuthMode;
};

function validateEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const safeNext = useMemo(
    () => getSafeAuthRedirect(searchParams.get("next")),
    [searchParams],
  );

  const isLogin = mode === "login";
  const title = isLogin ? "Log in to Creator" : "Create your Creator account";
  const description = isLogin
    ? "Enter the workspace for long-form video production."
    : "Start with only the credentials Creator needs right now.";
  const primaryLabel = isLogin ? "Log in" : "Create account";
  const secondaryHref = `${isLogin ? "/signup" : "/login"}?next=${encodeURIComponent(safeNext)}`;
  const secondaryLabel = isLogin ? "Create account" : "Log in instead";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();

    if (!validateEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      if (isLogin) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (loginError) {
          setError(getFriendlyAuthError(loginError.message));
          return;
        }

        router.replace(safeNext);
        router.refresh();
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
      const { data, error: signupError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { emailRedirectTo: redirectTo },
      });

      if (signupError) {
        setError(getFriendlyAuthError(signupError.message));
        return;
      }

      if (data.session) {
        router.replace(safeNext);
        router.refresh();
        return;
      }

      setNotice("Check your email to confirm your account, then return to log in.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error && caughtError.message.includes("NEXT_PUBLIC_SUPABASE")
          ? "Creator authentication is not configured. Add the required Supabase environment variables."
          : "Creator could not complete authentication. Try again in a moment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] px-5 py-8 text-stone-100">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-12 lg:grid-cols-[1fr_430px] lg:items-center">
          <section className="hidden lg:block">
            <Link href="/" className="text-sm font-medium text-stone-400 hover:text-stone-200">
              Creator
            </Link>
            <h1 className="mt-10 max-w-2xl text-5xl font-semibold tracking-[-0.04em] text-white">
              Professional video production, held behind a secure workspace.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-stone-400">
              Creator keeps the product quiet and focused: gameplay in, a structured long-form YouTube production workflow out.
            </p>
            <div className="mt-10 h-px max-w-md bg-gradient-to-r from-sky-400/50 to-transparent" />
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0d1118] p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div>
              <Link href="/" className="text-sm font-semibold tracking-tight text-white lg:hidden">
                Creator
              </Link>
              <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white lg:mt-0">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-400">{description}</p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
              <div>
                <label className="block text-sm font-medium text-stone-200" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-md border border-white/10 bg-black/25 px-3 py-3 text-white outline-none transition placeholder:text-stone-600 focus:border-sky-400/80 focus:ring-3 focus:ring-sky-400/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-200" htmlFor="password">
                  Password
                </label>
                <div className="mt-2 flex rounded-md border border-white/10 bg-black/25 focus-within:border-sky-400/80 focus-within:ring-3 focus-within:ring-sky-400/20">
                  <input
                    id="password"
                    name="password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="px-3 text-sm font-medium text-stone-400 transition hover:text-stone-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
                  {error}
                </p>
              ) : null}

              {notice ? (
                <p className="rounded-md border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-100" role="status">
                  {notice}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Working…" : primaryLabel}
              </button>
            </form>

            <div className="mt-6 border-t border-white/8 pt-6 text-sm text-stone-400">
              {isLogin ? "New to Creator?" : "Already have an account?"}{" "}
              <Link className="font-medium text-sky-300 hover:text-sky-200" href={secondaryHref}>
                {secondaryLabel}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
