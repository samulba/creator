import { headObject } from "../r2.js";
import { enqueuePipelineJob, loadOriginalSource } from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/**
 * Confirms the uploaded source object exists in R2 and matches the
 * recorded size, then chains to media probing. Pipeline stage: preparing.
 */
export const sourceValidation: JobHandler = async (job, ctx) => {
  await ctx.heartbeat({ stage: "validating_source", activity: "Checking the recording" });

  const asset = await loadOriginalSource(job.project_id);
  if (!asset) {
    throw new JobError("SOURCE_MISSING", "No uploaded source was found.", {
      retryable: false,
    });
  }
  if (asset.status !== "available") {
    // Retryable so a fresh upload can settle; if the retry budget runs out
    // the project must fail visibly — with failProject: false it would hang
    // in "preparing" forever with nothing for the user to retry.
    throw new JobError(
      "SOURCE_NOT_READY",
      "The uploaded source is not ready.",
      { retryable: true, failProject: true },
    );
  }

  const head = await headObject(asset.object_key);
  if (!head) {
    throw new JobError(
      "SOURCE_OBJECT_MISSING",
      "The recording could not be found in storage.",
      { retryable: false },
    );
  }
  if (
    asset.byte_size !== null &&
    head.byteSize !== null &&
    head.byteSize !== asset.byte_size
  ) {
    throw new JobError(
      "SOURCE_SIZE_MISMATCH",
      "The stored recording does not match the expected size.",
      { retryable: false },
    );
  }

  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "media_probe",
    idempotencyKey: `media-probe:${asset.id}`,
    payload: { asset_id: asset.id },
    parentJobId: job.id,
  });

  return { asset_id: asset.id, byte_size: head.byteSize };
};
