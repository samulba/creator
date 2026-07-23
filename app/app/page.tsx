import { redirect } from "next/navigation";

import { CreatorApp } from "@/components/app/creator-app";
import { getServerAuthState } from "@/src/lib/auth/session";
import { createClient } from "@/src/lib/supabase/server";
import type {
  ChannelRow,
  CharacterRow,
  ProjectCreativeSettingsRow,
  ProjectRow,
} from "@/src/lib/supabase/database.types";

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

  const supabase = await createClient();

  let projects: ProjectRow[] = [];
  let settings: ProjectCreativeSettingsRow[] = [];
  let channels: ChannelRow[] = [];
  let characters: CharacterRow[] = [];
  let schemaReady = true;

  // Channels/characters exist only after migration 002 has been applied
  // manually; a missing relation must degrade to a clear notice, not a 500.
  const channelsResult = await supabase
    .from("channels")
    .select("*")
    .is("archived_at", null)
    .order("name");

  if (channelsResult.error) {
    schemaReady = false;
  } else {
    channels = channelsResult.data;

    const [charactersResult, projectsResult, settingsResult] =
      await Promise.all([
        supabase
          .from("characters")
          .select("*")
          .is("archived_at", null)
          .order("name"),
        supabase
          .from("projects")
          .select("*")
          .is("deleted_at", null)
          .is("archived_at", null)
          .order("updated_at", { ascending: false }),
        supabase
          .from("project_creative_settings")
          .select("*")
          .eq("is_active", true),
      ]);

    characters = charactersResult.data ?? [];
    projects = projectsResult.data ?? [];
    settings = settingsResult.data ?? [];
  }

  return (
    <CreatorApp
      userEmail={auth.user.email ?? "Creator user"}
      projects={projects}
      settings={settings}
      channels={channels}
      characters={characters}
      schemaReady={schemaReady}
    />
  );
}
