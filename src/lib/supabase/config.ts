import { getSupabaseEnvironment } from "../../env";

export function getSupabaseConfig() {
  const env = getSupabaseEnvironment();

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  } as const;
}
