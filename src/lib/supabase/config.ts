export type SupabaseConfig = {
  url: string;
  /**
   * Public API key sent to the browser. Newer Supabase projects call this the
   * publishable key (`sb_publishable_...`); older projects call it the anon
   * key. Both are RLS-bound public keys — never a service-role or secret key.
   */
  publishableKey: string;
};

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

function readValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Returns the Supabase public configuration, or `null` when it is absent.
 *
 * NEXT_PUBLIC_ variables are only inlined into browser bundles when accessed
 * as static member expressions, so every variable must be referenced
 * literally here — never via dynamic `process.env[name]` lookups.
 */
export function getOptionalSupabaseConfig(): SupabaseConfig | null {
  const url = readValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey =
    readValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    readValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !publishableKey) {
    return null;
  }

  try {
    new URL(url);
  } catch {
    throw new SupabaseConfigurationError(
      "Invalid NEXT_PUBLIC_SUPABASE_URL value. Expected a valid URL.",
    );
  }

  return { url, publishableKey };
}

export function getSupabaseConfig(): SupabaseConfig {
  const config = getOptionalSupabaseConfig();

  if (!config) {
    throw new SupabaseConfigurationError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return config;
}
