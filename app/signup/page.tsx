import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
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

  return <AuthCard mode="signup" />;
}
