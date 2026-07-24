import { probe } from "../ffmpeg.js";
import { presignGet } from "../r2.js";
import {
  loadAssetById,
  loadEditVersion,
  loadOutputVersion,
  loadScriptSections,
  loadScriptVersion,
  setProjectState,
  updateOutputVersion,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/**
 * Quality control (Phase 10). FFprobe-based technical checks on the rendered
 * final video plus deterministic creative checks (forbidden-word scan and
 * catchphrase count against the frozen narrator config). No AI calls — every
 * check is reproducible. Pass → qc passed, project ready_for_review.
 * Fail → qc failed with the concrete violations in the failure message.
 * Pipeline stage: checking_quality → ready_for_review.
 */
export const qualityControl: JobHandler = async (job, ctx) => {
  await ctx.heartbeat({
    stage: "checking_quality",
    activity: "Running technical checks",
    percent: 10,
  });

  const payload = job.payload as { output_version_id?: string };
  if (!payload.output_version_id) {
    throw new JobError("QC_NO_OUTPUT", "No output version to check.", {
      retryable: false,
    });
  }

  const output = await loadOutputVersion(payload.output_version_id);
  if (!output) {
    throw new JobError("QC_OUTPUT_MISSING", "The output version is gone.", {
      retryable: false,
    });
  }

  // Idempotent re-run (retry after a crash): the verdict already exists.
  if (output.qc_status === "passed") {
    await setProjectState(job.project_id, "ready_for_review");
    return { qc: "passed", already: true };
  }

  if (!output.final_asset_id) {
    throw new JobError("QC_NO_FINAL_VIDEO", "The output has no final video.", {
      retryable: false,
    });
  }

  const finalAsset = await loadAssetById(output.final_asset_id, job.project_id);
  if (!finalAsset || finalAsset.status !== "available") {
    throw new JobError(
      "QC_FINAL_VIDEO_MISSING",
      "The final video file is not available in storage.",
      { retryable: false },
    );
  }

  await updateOutputVersion(output.id, { qc_status: "running" });

  const failures: string[] = [];
  const metrics: Record<string, unknown> = {};

  // ── Technical checks (ffprobe on the stored object) ─────────────────────
  const url = await presignGet(finalAsset.object_key);
  const media = await probe(url);
  metrics.probe = media;

  if (media.durationMs === null || media.durationMs < 1000) {
    failures.push("the video has no usable duration");
  }
  if (media.videoCodec !== "h264") {
    failures.push(`unexpected video codec (${media.videoCodec ?? "none"})`);
  }
  if (media.audioCodec === null) {
    failures.push("the video has no audio track");
  }
  if (media.height === null || media.height < 360) {
    failures.push(`resolution too low (${media.height ?? "unknown"}p)`);
  }

  // Duration vs the planned timeline. The final mix may trim slightly
  // (`-shortest`), so allow generous tolerance; a large gap means clips
  // were dropped or the encode was cut off.
  const edit = output.edit_version_id
    ? await loadEditVersion(output.edit_version_id)
    : null;
  if (edit?.timeline_duration_ms && media.durationMs !== null) {
    const expected = edit.timeline_duration_ms;
    const deviation = Math.abs(media.durationMs - expected);
    metrics.timeline_expected_ms = expected;
    metrics.timeline_deviation_ms = deviation;
    if (deviation > Math.max(10_000, expected * 0.15)) {
      failures.push(
        `duration deviates from the planned timeline by ${Math.round(deviation / 1000)}s`,
      );
    }
  }

  // ── Creative checks (deterministic, against the frozen narrator) ────────
  await ctx.heartbeat({
    stage: "checking_quality",
    activity: "Checking narration consistency",
    percent: 60,
  });

  if (output.script_version_id) {
    const script = await loadScriptVersion(output.script_version_id);
    const sections = script
      ? await loadScriptSections(output.script_version_id)
      : [];
    const config = (script?.narrator_config ?? {}) as {
      speech_style?: {
        forbidden_words?: unknown;
        catchphrases?: unknown;
      };
    };
    const forbidden = Array.isArray(config.speech_style?.forbidden_words)
      ? config.speech_style.forbidden_words.filter(
          (w): w is string => typeof w === "string" && w.trim().length > 0,
        )
      : [];
    const catchphrases = Array.isArray(config.speech_style?.catchphrases)
      ? config.speech_style.catchphrases.filter(
          (w): w is string => typeof w === "string" && w.trim().length > 0,
        )
      : [];

    const text = sections
      .map((section) => section.text)
      .join("\n")
      .toLowerCase();

    const violations = forbidden.filter((word) =>
      new RegExp(`\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(
        text,
      ),
    );
    metrics.forbidden_word_violations = violations;
    if (violations.length > 0) {
      failures.push(
        `narration contains forbidden words: ${violations.join(", ")}`,
      );
    }

    metrics.catchphrase_uses = catchphrases.reduce((count, phrase) => {
      const escaped = phrase
        .toLowerCase()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return count + (text.match(new RegExp(escaped, "g"))?.length ?? 0);
    }, 0);
  }

  if (failures.length > 0) {
    await updateOutputVersion(output.id, { qc_status: "failed" });
    throw new JobError(
      "QC_FAILED",
      `Quality control failed: ${failures.join("; ")}.`,
      { retryable: false, details: { failures, metrics } },
    );
  }

  await updateOutputVersion(output.id, { qc_status: "passed" });
  await setProjectState(job.project_id, "ready_for_review");

  await ctx.heartbeat({
    stage: "ready_for_review",
    activity: "Final video ready for review",
    percent: 100,
  });

  return { qc: "passed", metrics };
};
