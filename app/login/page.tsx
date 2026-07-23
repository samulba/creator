import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getServerAuthState } from "@/src/lib/auth/session";

// Auth state must be evaluated per request, even when Supabase env is
// absent at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const auth = await getServerAuthState();

  if (auth.status === "authenticated") {
    redirect("/app");
  }

  return (
    <AuthScreen
      mode="login"
      supabaseConfigured={auth.status !== "unconfigured"}
    />
  );
}
