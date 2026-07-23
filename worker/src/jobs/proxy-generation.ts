import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { env } from "../env.js";
import { generateProxy } from "../ffmpeg.js";
import { presignGet, uploadFile } from "../r2.js";
import {
  enqueuePipelineJob,
  insertAsset,
  loadOriginalSource,
  setProjectState,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/** Derives the project asset prefix from the source object key. */
function assetPrefix(sourceKey: string): string {
  const marker = "/assets/";
  const index = sourceKey.indexOf(marker);
  return index === -1 ? sourceKey : sourceKey.slice(0, index);
}

/**
 * Produces a downscaled analysis proxy with FFmpeg and uploads it to R2 as
 * a proxy_video asset. Then advances the project to "understanding_gameplay"
 * and enqueues coarse analysis (handled from Phase 5). Pipeline stage:
 * preparing → understanding_gameplay.
 */
export const proxyGeneration: JobHandler = async (job, ctx) => {
  await ctx.heartbeat({
    stage: "generating_proxy",
    activity: "Preparing the footage for analysis",
  });

  const asset = await loadOriginalSource(job.project_id);
  if (!asset) {
    throw new JobError("SOURCE_MISSING", "No uploaded source was found.", {
      retryable: false,
    });
  }

  const sourceUrl = await presignGet(asset.object_key);
  const proxyAssetId = randomUUID();
  const proxyKey = `${assetPrefix(asset.object_key)}/assets/${proxyAssetId}/proxy.mp4`;

  const workDir = await mkdtemp(join(tmpdir(), "creator-proxy-"));
  const proxyPath = join(workDir, "proxy.mp4");

  try {
    let lastHeartbeat = 0;
    await generateProxy(sourceUrl, proxyPath, env.proxyHeight, {
      onProgress: (line) => {
        // ffmpeg emits frequent progress lines; throttle heartbeats.
        const now = Date.now();
        if (now - lastHeartbeat > 15_000 && line.startsWith("frame=")) {
          lastHeartbeat = now;
          void ctx
            .heartbeat({
              stage: "generating_proxy",
              activity: "Preparing the footage for analysis",
            })
            .catch(() => {});
        }
      },
    });

    await uploadFile(proxyKey, proxyPath, "video/mp4");
  } catch (error) {
    if (error instanceof JobError) throw error;
    throw new JobError(
      "PROXY_FAILED",
      "Creator could not prepare the footage for analysis.",
      {
        retryable: true,
        details: { reason: error instanceof Error ? error.message : "unknown" },
      },
    );
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }

  await insertAsset({
    id: proxyAssetId,
    project_id: job.project_id,
    asset_type: "proxy_video",
    status: "available",
    bucket: asset.bucket,
    object_key: proxyKey,
    content_type: "video/mp4",
    available_at: new Date().toISOString(),
    created_by_job_id: job.id,
    metadata: { source_asset_id: asset.id, target_height: env.proxyHeight },
  });

  // Footage is prepared; move into the understanding stage and queue the
  // first analysis job (handled from Phase 5 — stays queued until then).
  await setProjectState(job.project_id, "understanding_gameplay");
  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "coarse_analysis",
    idempotencyKey: `coarse-analysis:${proxyAssetId}`,
    payload: { proxy_asset_id: proxyAssetId, source_asset_id: asset.id },
    parentJobId: job.id,
  });

  return { proxy_asset_id: proxyAssetId, object_key: proxyKey };
};
