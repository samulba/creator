import { env } from "@/src/env";
import { getOptionalStorageConfig } from "@/src/lib/storage/config";
import {
  getOptionalSupabaseConfig,
  SupabaseConfigurationError,
} from "@/src/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * Reports whether Supabase and R2 are configured — presence only, never
 * values. Lets a deployment be verified without logging in or exposing
 * any secret. All checks are booleans; no credential ever leaves here.
 */
function readiness() {
  let supabase: "configured" | "missing" | "invalid";
  try {
    supabase = getOptionalSupabaseConfig() ? "configured" : "missing";
  } catch (error) {
    supabase =
      error instanceof SupabaseConfigurationError ? "invalid" : "missing";
  }

  const storageConfig = getOptionalStorageConfig();

  return {
    supabase,
    storage: storageConfig ? "configured" : "missing",
    storageVariables: {
      R2_ACCOUNT_ID: Boolean(process.env.R2_ACCOUNT_ID?.trim()),
      R2_ACCESS_KEY_ID: Boolean(process.env.R2_ACCESS_KEY_ID?.trim()),
      R2_SECRET_ACCESS_KEY: Boolean(process.env.R2_SECRET_ACCESS_KEY?.trim()),
      R2_BUCKET: Boolean(process.env.R2_BUCKET?.trim()),
    },
  };
}

export function GET() {
  return Response.json({
    status: "healthy",
    service: "creator",
    environment: env.NODE_ENV,
    readiness: readiness(),
  });
}
