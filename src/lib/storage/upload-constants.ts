/**
 * Upload constants shared between the browser upload client and the
 * server actions. No secrets — safe for client bundles.
 */

/** Multipart part size. R2 requires >= 5 MiB per part (except the last). */
export const UPLOAD_PART_SIZE = 32 * 1024 * 1024; // 32 MiB

/** R2/S3 hard limit. */
export const MAX_UPLOAD_PARTS = 10_000;

/** Upper bound for one raw gameplay recording. */
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024 * 1024; // 32 GiB

/** Accepted source recordings (per product spec: MP4 or MOV). */
export const ALLOWED_SOURCE_CONTENT_TYPES: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
};

/** How many presigned part URLs the client may request per batch. */
export const MAX_PART_URL_BATCH = 20;

export function partCountFor(byteSize: number): number {
  return Math.max(1, Math.ceil(byteSize / UPLOAD_PART_SIZE));
}
