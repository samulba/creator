import { redirect } from "next/navigation";

import { CreatorApp } from "@/components/app-shell/creator-app";
import { createClient } from "@/src/lib/supabase/server";

function AuthConfigurationError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-5 text-stone-100">
      <section className="w-full max-w-lg rounded-xl border border-red-400/20 bg-[#0d1118] p-6 shadow-2xl shadow-black/20">
        <p className="text-sm font-medium text-red-200">Authentication is not configured</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Creator cannot open the workspace yet.
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          Add the required Supabase environment variables, then restart the application.
        </p>
      </section>
    </main>
  );
}

export default async function AppPage() {
  let userEmail: string | undefined;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    userEmail = user.email ?? "Creator user";
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_PUBLIC_SUPABASE")) {
      return <AuthConfigurationError />;
    }

    throw error;
  }

  return <CreatorApp userEmail={userEmail} />;
}
