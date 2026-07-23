import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import { env } from "../env.js";
import { probe } from "../ffmpeg.js";
import { logger } from "../logger.js";
import { downloadToFile, presignGet, uploadFile } from "../r2.js";
import {
  buildNarrationTrack,
  concatSegments,
  extractSegment,
  mixFinal,
  parseFfmpegTimeMs,
  scaledTimeoutMs,
} from "../render/ffmpeg-render.js";
import {
  clearCurrentOutputVersions,
  createOutputVersion,
  createRenderAttempt,
  enqueuePipelineJob,
  insertAsset,
  loadEditSegments,
  loadEditVersion,
  loadLatestEditVersion,
  loadNarrationObjectKeys,
  loadOriginalSource,
  loadOutputVersionByEdit,
  nextRenderAttemptNumber,
  nextVersionNumber,
  setProjectState,
  updateOutputVersion,
  updateRenderAttempt,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/** Derives the project asset prefix from an object key (before /assets/). */
function assetPrefix(objectKey: string): string {
  const marker = "/assets/";
  const index = objectKey.indexOf(marker);
  return index === -1 ? objectKey : objectKey.slice(0, index);
}

/**
 * Render engine (Phase 9). Cuts the EDL's segments from the source, concatenates
 * them, overlays narration (ducking the gameplay under it), encodes the final
 * MP4, uploads it as a final_video asset, and validates it with ffprobe.
 * Pipeline stage: building_edit → rendering → checking_quality.
 *
 * Idempotent on retry: reuses the output version for this edit and adds a new
 * render_attempt; narration is overlaid only where narration assets exist.
 */
export const render: JobHandler = async (job, ctx) => {
  await ctx.heartbeat({
    stage: "rendering",
    activity: "Preparing to render",
    percent: 0,
  });
  await setProjectState(job.project_id, "rendering");

  const payload = job.payload as { edit_version_id?: string };
  const edit = payload.edit_version_id
    ? await loadEditVersion(payload.edit_version_id)
    : await loadLatestEditVersion(job.project_id);
  if (!edit) {
    throw new JobError("RENDER_NO_EDIT", "No edit plan to render.", {
      retryable: false,
    });
  }

  const segments = await loadEditSegments(edit.id);
  if (segments.length === 0) {
    throw new JobError("RENDER_NO_SEGMENTS", "The edit plan has no segments.", {
      retryable: false,
    });
  }

  const source = await loadOriginalSource(job.project_id);
  if (!source) {
    throw new JobError("SOURCE_MISSING", "No source to render from.", {
      retryable: false,
    });
  }

  // Reuse the output version for this edit; add a fresh render attempt.
  const existing = await loadOutputVersionByEdit(edit.id);
  let outputVersionId: string;
  if (existing) {
    outputVersionId = existing.id;
    await updateOutputVersion(outputVersionId, { status: "rendering" });
  } else {
    await clearCurrentOutputVersions(job.project_id);
    const versionNumber = await nextVersionNumber("output_versions", job.project_id);
    outputVersionId = await createOutputVersion({
      project_id: job.project_id,
      version_number: versionNumber,
      status: "rendering",
      story_version_id: edit.story_version_id,
      script_version_id: edit.script_version_id,
      edit_version_id: edit.id,
      creative_settings_id: edit.creative_settings_id,
      is_current: true,
    });
  }

  const attemptNumber = await nextRenderAttemptNumber(outputVersionId);
  const renderAttemptId = await createRenderAttempt({
    project_id: job.project_id,
    output_version_id: outputVersionId,
    job_id: job.id,
    attempt_number: attemptNumber,
    status: "running",
    edit_version_id: edit.id,
    started_at: new Date().toISOString(),
  });

  const workDir = await mkdtemp(join(tmpdir(), "creator-render-"));
  const finalAssetId = randomUUID();
  const finalKey = `${assetPrefix(source.object_key)}/assets/${finalAssetId}/final.mp4`;
  const finalPath = join(workDir, "final.mp4");

  try {
    // 0) Fetch the source ONCE to local disk. Cutting every clip by seeking
    // into a presigned URL over HTTP was slow and flaky for long recordings
    // (the seek can force reading the file from the start — clip 1 then hits
    // the timeout, forever). Local cuts are fast and deterministic. If the
    // download fails (e.g. not enough disk), fall back to URL streaming with
    // a long-lived signature rather than failing the render outright.
    await ctx.heartbeat({
      stage: "rendering",
      activity: "Downloading the recording",
      percent: 1,
    });
    let sourceInput: string;
    try {
      const localSource = join(
        workDir,
        `source${extname(source.object_key) || ".mp4"}`,
      );
      let lastDownloadBeat = 0;
      await downloadToFile(source.object_key, localSource, {
        onProgress: (downloaded, total) => {
          const now = Date.now();
          if (now - lastDownloadBeat < 10_000) return;
          lastDownloadBeat = now;
          const size = total ?? source.byte_size;
          void ctx
            .heartbeat({
              stage: "rendering",
              activity: "Downloading the recording",
              percent: size
                ? Math.min(14, 1 + Math.floor((downloaded / size) * 13))
                : 1,
            })
            .catch(() => {});
        },
      });
      sourceInput = localSource;
    } catch (downloadError) {
      logger.warn("source download failed; falling back to URL streaming", {
        job_id: job.id,
        reason:
          downloadError instanceof Error ? downloadError.message : "unknown",
      });
      sourceInput = await presignGet(source.object_key, 12 * 3600);
    }

    // 1) Cut + normalize each segment. The timeout scales with the clip's
    // duration, and ffmpeg's own progress feeds honest within-clip percent.
    const segmentPaths: string[] = [];
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i]!;
      const start = seg.source_start_ms;
      const end = seg.source_end_ms;
      if (start === null || end === null || end <= start) continue;
      const clipDurationMs = end - start;
      // Clip extraction is the bulk of render time → band 15–70%.
      const clipBase = 15 + (i / segments.length) * 55;
      const clipSpan = 55 / segments.length;
      await ctx.heartbeat({
        stage: "rendering",
        activity: `Rendering clip ${i + 1}/${segments.length}`,
        percent: Math.round(clipBase),
      });
      const segPath = join(workDir, `seg_${i}.mp4`);
      let lastClipBeat = 0;
      try {
        await extractSegment(sourceInput, start, end, segPath, {
          height: env.renderHeight,
          fps: env.renderFps,
          timeoutMs: scaledTimeoutMs(clipDurationMs),
          onProgress: (line) => {
            const doneMs = parseFfmpegTimeMs(line);
            if (doneMs === null) return;
            const now = Date.now();
            if (now - lastClipBeat < 10_000) return;
            lastClipBeat = now;
            void ctx
              .heartbeat({
                stage: "rendering",
                activity: `Rendering clip ${i + 1}/${segments.length}`,
                percent: Math.round(
                  clipBase + Math.min(1, doneMs / clipDurationMs) * clipSpan,
                ),
              })
              .catch(() => {});
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("timed out")) {
          throw new JobError(
            "RENDER_CLIP_TIMEOUT",
            `Cutting clip ${i + 1} of ${segments.length} took too long and was stopped.`,
            { retryable: true, details: { clip_duration_ms: clipDurationMs } },
          );
        }
        throw error;
      }
      segmentPaths.push(segPath);
    }
    if (segmentPaths.length === 0) {
      throw new JobError("RENDER_NO_CLIPS", "No renderable clips.", {
        retryable: false,
      });
    }

    // The source copy is no longer needed — free the disk before the
    // concat + final encode double the segment footprint.
    if (sourceInput.startsWith(workDir)) {
      await rm(sourceInput, { force: true }).catch(() => {});
    }

    // 2) Concatenate into the gameplay track.
    await ctx.heartbeat({
      stage: "rendering",
      activity: "Assembling the timeline",
      percent: 72,
    });
    const gameplayPath = join(workDir, "gameplay.mp4");
    await concatSegments(segmentPaths, gameplayPath, workDir);
    const gameplayProbe = await probe(gameplayPath);
    const timelineMs =
      gameplayProbe.durationMs ?? edit.timeline_duration_ms ?? 0;

    // 3) Build the narration track from available narration, positioned on the
    //    output timeline. Narration is best-effort: none → gameplay-only render.
    const sectionIds = segments
      .map((s) => s.script_section_id)
      .filter((id): id is string => id !== null);
    const narrationKeys = await loadNarrationObjectKeys(sectionIds);
    const narrationClips: Array<{ url: string; delayMs: number }> = [];
    for (const seg of segments) {
      if (!seg.script_section_id) continue;
      const objectKey = narrationKeys.get(seg.script_section_id);
      if (!objectKey) continue;
      narrationClips.push({
        url: await presignGet(objectKey),
        delayMs: seg.output_start_ms,
      });
    }

    let narrationPath: string | null = null;
    if (narrationClips.length > 0 && timelineMs > 0) {
      await ctx.heartbeat({
        stage: "rendering",
        activity: "Mixing narration",
        percent: 76,
      });
      narrationPath = join(workDir, "narration.wav");
      await buildNarrationTrack(narrationClips, timelineMs, narrationPath);
    }

    // 4) Final mix + encode. Timeout scales with the timeline (the full-length
    // re-encode is the slowest single ffmpeg run), progress from ffmpeg.
    await ctx.heartbeat({
      stage: "rendering",
      activity: "Encoding the final video",
      percent: 80,
    });
    let lastEncodeBeat = 0;
    try {
      await mixFinal(gameplayPath, narrationPath, finalPath, {
        timeoutMs: scaledTimeoutMs(timelineMs, 4),
        onProgress: (line) => {
          const doneMs = parseFfmpegTimeMs(line);
          if (doneMs === null || timelineMs <= 0) return;
          const now = Date.now();
          if (now - lastEncodeBeat < 10_000) return;
          lastEncodeBeat = now;
          void ctx
            .heartbeat({
              stage: "rendering",
              activity: "Encoding the final video",
              percent: Math.round(80 + Math.min(1, doneMs / timelineMs) * 17),
            })
            .catch(() => {});
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("timed out")) {
        throw new JobError(
          "RENDER_ENCODE_TIMEOUT",
          "Encoding the final video took too long and was stopped.",
          { retryable: true, details: { timeline_ms: timelineMs } },
        );
      }
      throw error;
    }

    // Upload + validate (9.2 render validation).
    await ctx.heartbeat({
      stage: "rendering",
      activity: "Uploading the final video",
      percent: 98,
    });
    await uploadFile(finalKey, finalPath, "video/mp4");
    const finalProbe = await probe(finalPath);
    if (
      finalProbe.durationMs === null ||
      finalProbe.durationMs <= 0 ||
      finalProbe.width === null ||
      finalProbe.videoCodec === null
    ) {
      throw new JobError(
        "RENDER_VALIDATION_FAILED",
        "The rendered video failed validation (missing stream or duration).",
        { retryable: true, details: { probe: finalProbe } },
      );
    }
    if (finalProbe.audioCodec === null) {
      // A deterministic property of the source (it has no audio track), so
      // retrying can never succeed — fail cleanly instead of looping.
      throw new JobError(
        "RENDER_NO_AUDIO",
        "The source recording has no audio track, so a final video could not be produced.",
        { retryable: false, details: { probe: finalProbe } },
      );
    }

    await insertAsset({
      id: finalAssetId,
      project_id: job.project_id,
      asset_type: "final_video",
      status: "available",
      bucket: source.bucket,
      object_key: finalKey,
      content_type: "video/mp4",
      byte_size: null,
      duration_ms: finalProbe.durationMs,
      width: finalProbe.width,
      height: finalProbe.height,
      frame_rate: finalProbe.frameRate,
      video_codec: finalProbe.videoCodec,
      audio_codec: finalProbe.audioCodec,
      available_at: new Date().toISOString(),
      created_by_job_id: job.id,
      metadata: {
        edit_version_id: edit.id,
        output_version_id: outputVersionId,
        segment_count: segmentPaths.length,
        narration_clip_count: narrationClips.length,
      },
    });

    await updateRenderAttempt(renderAttemptId, {
      status: "succeeded",
      output_asset_id: finalAssetId,
      completed_at: new Date().toISOString(),
      technical_metadata: {
        duration_ms: finalProbe.durationMs,
        width: finalProbe.width,
        height: finalProbe.height,
        frame_rate: finalProbe.frameRate,
        video_codec: finalProbe.videoCodec,
        audio_codec: finalProbe.audioCodec,
        segment_count: segmentPaths.length,
        narration_clip_count: narrationClips.length,
      },
    });
    await updateOutputVersion(outputVersionId, {
      status: "rendered",
      final_asset_id: finalAssetId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await updateRenderAttempt(renderAttemptId, {
      status: "failed",
      error_code: error instanceof JobError ? error.code : "RENDER_ERROR",
      error_message: message.slice(0, 2000),
      completed_at: new Date().toISOString(),
    }).catch(() => {});
    await updateOutputVersion(outputVersionId, { status: "failed" }).catch(() => {});
    if (error instanceof JobError) throw error;
    throw new JobError("RENDER_FAILED", "The render did not complete.", {
      retryable: true,
      details: { reason: message },
    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }

  // Rendered; hand off to quality control (Phase 10 — stays queued until then).
  await setProjectState(job.project_id, "checking_quality");
  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "quality_control",
    idempotencyKey: `quality-control:${outputVersionId}`,
    payload: { output_version_id: outputVersionId },
    parentJobId: job.id,
  });

  return { output_version_id: outputVersionId, final_asset_id: finalAssetId };
};
