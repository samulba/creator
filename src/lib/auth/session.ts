import "server-only";

import type { User } from "@supabase/supabase-js";

import { getOptionalSupabaseConfig } from "@/src/lib/supabase/config";
import { createClient } from "@/src/lib/supabase/server";

export type ServerAuthState =
  | { status: "unconfigured"; user: null }
  | { status: "unauthenticated"; user: null }
  | { status: "authenticated"; user: User };

/**
 * Resolves the authenticated user for Server Components without forcing
 * every page to distinguish "Supabase env missing" from "not logged in"
 * via caught exceptions.
 */
export async function getServerAuthState(): Promise<ServerAuthState> {
  if (!getOptionalSupabaseConfig()) {
    return { status: "unconfigured", user: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated", user: null };
  }

  return { status: "authenticated", user };
}
