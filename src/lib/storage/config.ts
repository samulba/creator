import "server-only";

/**
 * Cloudflare R2 configuration. Server-only — these credentials must never
 * reach a client bundle, so this module guards itself with "server-only"
 * and nothing here uses a NEXT_PUBLIC_ prefix.
 */
export type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function readValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Returns the R2 configuration, or `null` when storage is not configured. */
export function getOptionalStorageConfig(): StorageConfig | null {
  const accountId = readValue(process.env.R2_ACCOUNT_ID);
  const accessKeyId = readValue(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = readValue(process.env.R2_SECRET_ACCESS_KEY);
  const bucket = readValue(process.env.R2_BUCKET);

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}
