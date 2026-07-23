"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getOptionalStorageConfig } from "@/src/lib/storage/config";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  headObject,
  presignGetObject,
  presignUploadPart,
} from "@/src/lib/storage/r2";
import {
  ALLOWED_SOURCE_CONTENT_TYPES,
  MAX_PART_URL_BATCH,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_PARTS,
  UPLOAD_PART_SIZE,
  partCountFor,
} from "@/src/lib/storage/upload-constants";

import {
  failure,
  isUuid,
  requireActionContext,
  type ActionResult,
} from "./shared";

function revalidate() {
  revalidatePath("/app");
}

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "recording";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "recording";
}

/** Reads the multipart upload id stored in the asset's metadata. */
function uploadIdOf(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).upload_id;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

/**
 * Starts a direct browser→R2 multipart upload for a project's original
 * gameplay source. The server validates ownership, generates the object
 * key, creates the asset row, and opens the multipart upload — the file
 * bytes never touch the web application.
 */
export async function startSourceUpload(input: {
  projectId: string;
  filename: string;
  byteSize: number;
  contentType: string;
}): Promise<
  ActionResult<{ assetId: string; partSize: number; partCount: number }>
> {
  const context = await requireActionContext();
  if (!context.ok) return context;

  const storage = getOptionalStorageConfig();
  if (!storage) {
    return failure(
      "Storage is not configured. Set the R2_* environment variables.",
    );
  }

  if (!isUuid(input.projectId)) return failure("Invalid project id.");

  if (!ALLOWED_SOURCE_CONTENT_TYPES[input.contentType]) {
    return failure("Use an MP4 or MOV gameplay recording.");
  }

  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > MAX_UPLOAD_BYTES
  ) {
    return failure("The file size is outside the supported range (max 32 GB).");
  }

  if (partCountFor(input.byteSize) > MAX_UPLOAD_PARTS) {
    return failure("The file has too many upload parts.");
  }

  // RLS scopes this to the user's own projects.
  const { data: project, error: projectError } = await context.supabase
    .from("projects")
    .select("id, archived_at")
    .eq("id", input.projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectError) return failure("The project could not be loaded.");
  if (!project) return failure("Project not found.");
  if (project.archived_at) return failure("Unarchive the project first.");

  const { data: existing, error: existingError } = await context.supabase
    .from("assets")
    .select("id, status")
    .eq("project_id", input.projectId)
    .eq("asset_type", "original_source")
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) return failure("Existing uploads could not be checked.");
  if (existing?.status === "available") {
    return failure("This project already has an uploaded source.");
  }
  if (existing) {
    return failure(
      "An upload is already in progress for this project. Cancel it first.",
    );
  }

  const assetId = randomUUID();
  const objectKey = `users/${context.user.id}/projects/${input.projectId}/assets/${assetId}/${sanitizeFilename(input.filename)}`;

  let uploadId: string;
  try {
    uploadId = await createMultipartUpload(objectKey, input.contentType);
  } catch {
    return failure("The upload could not be started in storage.");
  }

  const { error: insertError } = await context.supabase.from("assets").insert({
    id: assetId,
    project_id: input.projectId,
    asset_type: "original_source",
    status: "uploading",
    bucket: storage.bucket,
    object_key: objectKey,
    original_filename: input.filename.slice(0, 500),
    content_type: input.contentType,
    byte_size: input.byteSize,
    metadata: { upload_id: uploadId, part_size: UPLOAD_PART_SIZE },
  });

  if (insertError) {
    await abortMultipartUpload(objectKey, uploadId).catch(() => {});
    return failure("The upload could not be registered.");
  }

  revalidate();
  return {
    ok: true,
    data: {
      assetId,
      partSize: UPLOAD_PART_SIZE,
      partCount: partCountFor(input.byteSize),
    },
  };
}

/** Loads an uploading asset after verifying ownership via RLS. */
async function loadUploadingAsset(
  context: Extract<
    Awaited<ReturnType<typeof requireActionContext>>,
    { ok: true }
  >,
  assetId: string,
) {
  const { data: asset, error } = await context.supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .eq("asset_type", "original_source")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !asset) return null;
  return asset;
}

export async function getUploadPartUrls(input: {
  assetId: string;
  partNumbers: number[];
}): Promise<
  ActionResult<{ urls: Array<{ partNumber: number; url: string }> }>
> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(input.assetId)) return failure("Invalid asset id.");

  if (
    !Array.isArray(input.partNumbers) ||
    input.partNumbers.length === 0 ||
    input.partNumbers.length > MAX_PART_URL_BATCH ||
    input.partNumbers.some(
      (part) =>
        !Number.isSafeInteger(part) || part < 1 || part > MAX_UPLOAD_PARTS,
    )
  ) {
    return failure("Invalid part numbers.");
  }

  const asset = await loadUploadingAsset(context, input.assetId);
  if (!asset || asset.status !== "uploading") {
    return failure("No active upload for this asset.");
  }

  const uploadId = uploadIdOf(asset.metadata);
  if (!uploadId) return failure("The upload state is invalid.");

  try {
    const urls = await Promise.all(
      input.partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await presignUploadPart(asset.object_key, uploadId, partNumber),
      })),
    );

    return { ok: true, data: { urls } };
  } catch {
    return failure("Upload URLs could not be created.");
  }
}

export async function completeSourceUpload(input: {
  assetId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(input.assetId)) return failure("Invalid asset id.");

  if (
    !Array.isArray(input.parts) ||
    input.parts.length === 0 ||
    input.parts.length > MAX_UPLOAD_PARTS ||
    input.parts.some(
      (part) =>
        !Number.isSafeInteger(part.partNumber) ||
        part.partNumber < 1 ||
        typeof part.etag !== "string" ||
        part.etag.length === 0 ||
        part.etag.length > 200,
    )
  ) {
    return failure("Invalid part list.");
  }

  const asset = await loadUploadingAsset(context, input.assetId);
  if (!asset || asset.status !== "uploading") {
    return failure("No active upload for this asset.");
  }

  const uploadId = uploadIdOf(asset.metadata);
  if (!uploadId) return failure("The upload state is invalid.");

  try {
    await completeMultipartUpload(asset.object_key, uploadId, input.parts);
  } catch {
    return failure(
      "The upload could not be finalized in storage. Retry or cancel the upload.",
    );
  }

  // Verify the object server-side before trusting it.
  const head = await headObject(asset.object_key).catch(() => null);
  if (!head) {
    return failure("The uploaded object could not be verified.");
  }

  if (asset.byte_size !== null && head.byteSize !== asset.byte_size) {
    await context.supabase
      .from("assets")
      .update({ status: "failed" })
      .eq("id", asset.id);
    return failure(
      "The uploaded file does not match the expected size. Cancel and retry.",
    );
  }

  const { error: updateError } = await context.supabase
    .from("assets")
    .update({
      status: "available",
      available_at: new Date().toISOString(),
      byte_size: head.byteSize ?? asset.byte_size,
      content_type: head.contentType ?? asset.content_type,
    })
    .eq("id", asset.id);

  if (updateError) return failure("The upload could not be recorded.");

  await context.supabase
    .from("projects")
    .update({ source_asset_id: asset.id })
    .eq("id", asset.project_id);

  // Kick off the pipeline: enqueue source validation (idempotent) and move
  // the project into "preparing". Tolerates a database where migration 004
  // has not been applied yet — the project then simply stays in draft.
  const { error: enqueueError } = await context.supabase.rpc("enqueue_job", {
    p_project_id: asset.project_id,
    p_job_type: "source_validation",
    p_idempotency_key: `source-validation:${asset.id}`,
    p_payload: { asset_id: asset.id },
  });

  if (!enqueueError) {
    await context.supabase
      .from("projects")
      .update({ pipeline_state: "preparing" })
      .eq("id", asset.project_id);
  }

  revalidate();
  return { ok: true };
}

export async function abortSourceUpload(
  assetId: string,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(assetId)) return failure("Invalid asset id.");

  const asset = await loadUploadingAsset(context, assetId);
  if (!asset) return failure("Upload not found.");
  if (asset.status === "available") {
    return failure("This upload is already complete.");
  }

  const uploadId = uploadIdOf(asset.metadata);
  if (uploadId) {
    await abortMultipartUpload(asset.object_key, uploadId).catch(() => {});
  }

  // The multipart upload is aborted (no object remains), so the row can be
  // tombstoned immediately, freeing the one-original-per-project slot.
  const { error } = await context.supabase
    .from("assets")
    .update({
      status: "deleted",
      delete_requested_at: new Date().toISOString(),
      deleted_at: new Date().toISOString(),
    })
    .eq("id", asset.id);

  if (error) return failure("The upload could not be cancelled.");

  revalidate();
  return { ok: true };
}

export async function getSourceDownloadUrl(
  assetId: string,
): Promise<ActionResult<{ url: string }>> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(assetId)) return failure("Invalid asset id.");

  const asset = await loadUploadingAsset(context, assetId);
  if (!asset || asset.status !== "available") {
    return failure("No uploaded source available.");
  }

  try {
    const url = await presignGetObject(
      asset.object_key,
      asset.original_filename ?? undefined,
    );
    return { ok: true, data: { url } };
  } catch {
    return failure("The download link could not be created.");
  }
}
