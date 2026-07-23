import { probe } from "../ffmpeg.js";
import { presignGet } from "../r2.js";
import {
  enqueuePipelineJob,
  loadOriginalSource,
  updateAsset,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/**
 * Extracts technical metadata (duration, resolution, codecs, frame rate)
 * from the source with FFprobe over a presigned URL, writes it onto the
 * asset, then chains to proxy generation. Pipeline stage: preparing.
 */
export const mediaProbe: JobHandler = async (job, ctx) => {
  await ctx.heartbeat({ stage: "probing_media", activity: "Reading the recording" });

  const asset = await loadOriginalSource(job.project_id);
  if (!asset) {
    throw new JobError("SOURCE_MISSING", "No uploaded source was found.", {
      retryable: false,
    });
  }

  const url = await presignGet(asset.object_key);

  let result;
  try {
    result = await probe(url);
  } catch (error) {
    throw new JobError(
      "PROBE_FAILED",
      "Creator could not read this recording.",
      {
        retryable: false,
        details: { reason: error instanceof Error ? error.message : "unknown" },
      },
    );
  }

  if (result.durationMs === null || result.width === null) {
    throw new JobError(
      "PROBE_INCOMPLETE",
      "The recording is missing a readable video track.",
      { retryable: false },
    );
  }

  await updateAsset(asset.id, {
    duration_ms: result.durationMs,
    width: result.width,
    height: result.height,
    frame_rate: result.frameRate,
    video_codec: result.videoCodec,
    audio_codec: result.audioCodec,
    metadata: {
      ...asset.metadata,
      probe: {
        format_name: result.formatName,
        probed_at: new Date().toISOString(),
      },
    },
  });

  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "proxy_generation",
    idempotencyKey: `proxy-generation:${asset.id}:v1`,
    payload: { asset_id: asset.id },
    parentJobId: job.id,
  });

  return {
    duration_ms: result.durationMs,
    width: result.width,
    height: result.height,
    frame_rate: result.frameRate,
    video_codec: result.videoCodec,
    audio_codec: result.audioCodec,
  };
};
