import { redirect } from "next/navigation";

import { CreatorApp } from "@/components/app/creator-app";
import { getServerAuthState } from "@/src/lib/auth/session";

// Auth state must be evaluated per request, even when Supabase env is
// absent at build time.
export const dynamic = "force-dynamic";

function SupabaseConfigurationNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <section className="w-full max-w-lg border-l-2 border-warn/60 pl-6">
        <p className="text-xs font-medium tracking-wide text-warn uppercase">
          Authentication not configured
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          Creator cannot open the workspace yet.
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-secondary">
          Set{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          </code>{" "}
          in the environment, then restart the application.
        </p>
      </section>
    </main>
  );
}

export default async function AppPage() {
  const auth = await getServerAuthState();

  if (auth.status === "unconfigured") {
    return <SupabaseConfigurationNotice />;
  }

  if (auth.status === "unauthenticated") {
    redirect("/login");
  }

  return <CreatorApp userEmail={auth.user.email ?? "Creator user"} />;
}
