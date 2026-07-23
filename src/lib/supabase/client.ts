"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

export function createClient() {
  const supabaseConfig = getSupabaseConfig();

  return createBrowserClient<Database>(
    supabaseConfig.url,
    supabaseConfig.anonKey,
  );
}
