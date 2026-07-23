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

  /** Final render target height + frame rate. */
  renderHeight: optionalInt("WORKER_RENDER_HEIGHT", 1080),
  renderFps: optionalInt("WORKER_RENDER_FPS", 30),

  /**
   * Gemini gameplay analysis (Phase 5). Optional: when GEMINI_API_KEY is
   * absent the worker simply does not claim `coarse_analysis` jobs, so the
   * pipeline pauses at "understanding_gameplay" instead of failing. The key
   * is a server-side secret — it lives only in the worker environment.
   */
  gemini: {
    apiKey: process.env.GEMINI_API_KEY?.trim() || null,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash",
    /** Max wall-clock to wait for an uploaded file to become ACTIVE. */
    fileActiveTimeoutMs: optionalInt("GEMINI_FILE_TIMEOUT_MS", 5 * 60_000),
    /** Max wall-clock for a single generateContent call. */
    requestTimeoutMs: optionalInt("GEMINI_REQUEST_TIMEOUT_MS", 10 * 60_000),
  },

  /**
   * ElevenLabs narration (Phase 7). Optional: without ELEVENLABS_API_KEY the
   * worker does not claim `voice_generation` jobs, so the pipeline pauses at
   * "generating_voice". The default model is a PINNED id, never a "latest"
   * alias — the actual per-character model comes from the character's
   * voice_settings.model_id when set. Server-side secret; worker only.
   */
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || null,
    defaultModel: process.env.ELEVENLABS_MODEL?.trim() || "eleven_multilingual_v2",
    outputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || "mp3_44100_128",
    requestTimeoutMs: optionalInt("ELEVENLABS_REQUEST_TIMEOUT_MS", 5 * 60_000),
  },
} as const;

/** True when Gemini analysis is configured and coarse_analysis can run. */
export const geminiConfigured = env.gemini.apiKey !== null;

/** True when ElevenLabs is configured and voice_generation can run. */
export const elevenLabsConfigured = env.elevenlabs.apiKey !== null;
