"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { getFriendlyAuthError } from "@/src/lib/auth/errors";
import { getSafeAuthRedirect } from "@/src/lib/auth/redirects";
import { createClient } from "@/src/lib/supabase/client";
import { SupabaseConfigurationError } from "@/src/lib/supabase/config";

type AuthMode = "login" | "signup";

function validateEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

export function AuthForm({ mode }: { mode: AuthMode }) {
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
  const secondaryHref = `${isLogin ? "/signup" : "/login"}?next=${encodeURIComponent(safeNext)}`;

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

      setNotice(
        "Check your email to confirm your account, then return to log in.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof SupabaseConfigurationError
          ? "Creator authentication is not configured. Add the required Supabase environment variables."
          : "Creator could not complete authentication. Try again in a moment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={isLogin ? undefined : "At least 6 characters"}
        >
          <div className="relative">
            <Input
              id="password"
              name="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-16"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {notice ? <FormMessage tone="notice">{notice}</FormMessage> : null}

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Working…" : isLogin ? "Log in" : "Create account"}
        </Button>
      </form>

      <p className="mt-8 border-t border-edge pt-5 text-sm text-ink-secondary">
        {isLogin ? "New to Creator?" : "Already have an account?"}{" "}
        <Link
          className="font-medium text-ink underline decoration-edge-strong underline-offset-4 transition-colors hover:decoration-accent"
          href={secondaryHref}
        >
          {isLogin ? "Create an account" : "Log in instead"}
        </Link>
      </p>
    </div>
  );
}
