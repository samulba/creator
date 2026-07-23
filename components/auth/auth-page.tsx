import { Suspense } from "react";

import { AuthCard } from "./auth-card";

type AuthMode = "login" | "signup";

type AuthPageProps = {
  mode: AuthMode;
};

function AuthPageFallback() {
  return (
    <div className="min-h-screen bg-[#07090d] px-5 py-8 text-stone-100">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <section className="w-full max-w-[430px] rounded-xl border border-white/10 bg-[#0d1118] p-8 shadow-2xl shadow-black/20">
          <div className="h-4 w-20 rounded bg-white/10" />
          <div className="mt-8 h-7 w-56 rounded bg-white/10" />
          <div className="mt-3 h-4 w-72 max-w-full rounded bg-white/8" />
          <div className="mt-8 space-y-5">
            <div className="h-12 rounded-md border border-white/10 bg-black/25" />
            <div className="h-12 rounded-md border border-white/10 bg-black/25" />
            <div className="h-12 rounded-md bg-sky-400/40" />
          </div>
        </section>
      </main>
    </div>
  );
}

export function AuthPage({ mode }: AuthPageProps) {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthCard mode={mode} />
    </Suspense>
  );
}
