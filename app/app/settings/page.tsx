import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app/app-sidebar";
import { SettingsView } from "@/components/settings/settings-view";
import { getServerAuthState } from "@/src/lib/auth/session";
import { createClient } from "@/src/lib/supabase/server";
import type {
  ChannelRow,
  CharacterRow,
} from "@/src/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await getServerAuthState();

  if (auth.status === "unconfigured") {
    redirect("/app");
  }

  if (auth.status === "unauthenticated") {
    redirect("/login");
  }

  const supabase = await createClient();

  let channels: ChannelRow[] = [];
  let characters: CharacterRow[] = [];
  let schemaReady = true;

  const channelsResult = await supabase
    .from("channels")
    .select("*")
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("name");

  if (channelsResult.error) {
    schemaReady = false;
  } else {
    channels = channelsResult.data;
    const charactersResult = await supabase
      .from("characters")
      .select("*")
      .order("archived_at", { ascending: true, nullsFirst: true })
      .order("name");
    characters = charactersResult.data ?? [];
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <AppSidebar
        userEmail={auth.user.email ?? "Creator user"}
        active="settings"
      />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <SettingsView
          channels={channels}
          characters={characters}
          schemaReady={schemaReady}
        />
      </main>
    </div>
  );
}
