"use server";

import { revalidatePath } from "next/cache";

import { getOptionalStorageConfig } from "@/src/lib/storage/config";
import { presignGetObject } from "@/src/lib/storage/r2";

import {
  failure,
  isUuid,
  requireActionContext,
  type ActionResult,
} from "./shared";

export type FinalOutput = {
  outputVersionId: string;
  versionNumber: number;
  qcStatus: string;
  isApproved: boolean;
  durationMs: number | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
};

/** Loads the current output version + final video metadata (RLS-scoped). */
export async function getFinalOutput(
  projectId: string,
): Promise<ActionResult<FinalOutput>> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(projectId)) return failure("Invalid project id.");

  const { data: output, error } = await context.supabase
    .from("output_versions")
    .select("id, version_number, qc_status, is_approved, final_asset_id")
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) return failure("The output could not be loaded.");
  if (!output?.final_asset_id) {
    return failure("No final video exists for this project yet.");
  }

  const { data: asset, error: assetError } = await context.supabase
    .from("assets")
    .select("id, status, duration_ms, byte_size, width, height")
    .eq("id", output.final_asset_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (assetError) return failure("The final video could not be loaded.");
  if (!asset || asset.status !== "available") {
    return failure("The final video file is not available.");
  }

  return {
    ok: true,
    data: {
      outputVersionId: output.id,
      versionNumber: output.version_number,
      qcStatus: output.qc_status,
      isApproved: output.is_approved,
      durationMs: asset.duration_ms,
      byteSize: asset.byte_size,
      width: asset.width,
      height: asset.height,
    },
  };
}

/** Presigns a download for the current final video. */
export async function getFinalVideoDownloadUrl(
  projectId: string,
): Promise<ActionResult<{ url: string }>> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(projectId)) return failure("Invalid project id.");

  if (!getOptionalStorageConfig()) {
    return failure("Storage is not configured.");
  }

  const { data: output, error } = await context.supabase
    .from("output_versions")
    .select("final_asset_id")
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();

  if (error || !output?.final_asset_id) {
    return failure("No final video to download.");
  }

  const { data: asset, error: assetError } = await context.supabase
    .from("assets")
    .select("object_key, status")
    .eq("id", output.final_asset_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (assetError || !asset || asset.status !== "available") {
    return failure("The final video file is not available.");
  }

  const { data: project } = await context.supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();

  const title = project?.title ?? "final-video";
  const filename = `${title.replace(/[^\w\s.-]/g, "").trim() || "final-video"}.mp4`;

  try {
    const url = await presignGetObject(asset.object_key, filename);
    return { ok: true, data: { url } };
  } catch {
    return failure("The download link could not be created.");
  }
}

/** Approves the current QC-passed output (migration 015 RPC). */
export async function approveFinalOutput(
  projectId: string,
): Promise<ActionResult> {
  const context = await requireActionContext();
  if (!context.ok) return context;
  if (!isUuid(projectId)) return failure("Invalid project id.");

  const { data, error } = await context.supabase.rpc("approve_current_output", {
    p_project_id: projectId,
  });

  if (error) {
    return failure(
      "Approval is not available yet. Run migration 015 in the Supabase SQL Editor.",
    );
  }
  if (!data) return failure("There is no approvable video for this project.");

  revalidatePath("/app");
  return { ok: true };
}
