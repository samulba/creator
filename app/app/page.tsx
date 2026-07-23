import { redirect } from "next/navigation";

import { CreatorApp } from "@/components/app-shell/creator-app";
import { createClient } from "@/src/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CreatorApp userEmail={user.email ?? "Creator user"} />;
}
