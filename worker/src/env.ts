function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${name}: expected a number.`);
  }
  return value;
}

/**
 * Worker configuration. The worker runs outside the browser and uses the
 * Supabase service-role key plus R2 credentials — none of these may ever
 * reach a client bundle. They live only in the worker's environment.
 */
export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  r2: {
    accountId: required("R2_ACCOUNT_ID"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    bucket: required("R2_BUCKET"),
  },

  /** Stable-ish worker identity; a random suffix is appended at runtime. */
  workerName: process.env.WORKER_NAME?.trim() || "creator-worker",

  /** Seconds a claimed job lease lasts before another worker may reclaim it. */
  leaseSeconds: optionalInt("WORKER_LEASE_SECONDS", 300),

  /** Idle poll interval when no job is available. */
  pollIntervalMs: optionalInt("WORKER_POLL_INTERVAL_MS", 4000),

  /** Proxy generation target height (analysis proxy, not final render). */
  proxyHeight: optionalInt("WORKER_PROXY_HEIGHT", 720),
} as const;
