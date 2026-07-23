import { redirect } from "next/navigation";

import { AuthPage } from "@/components/auth/auth-page";
import { createClient } from "@/src/lib/supabase/server";

export default async function SignupPage() {
  let isAuthenticated = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  } catch {
    // The client form shows a configuration-specific error if Supabase env is missing.
  }

  if (isAuthenticated) {
    redirect("/app");
  }

  return <AuthPage mode="signup" />;
}
