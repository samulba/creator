import { buildEdl, EDL_SCHEMA_VERSION, type EdlBeat } from "../edit/edl.js";
import {
  createEditVersion,
  enqueuePipelineJob,
  insertEditSegments,
  loadActiveCreativeSettings,
  loadCandidateMoments,
  loadLatestScriptVersion,
  loadOriginalSource,
  loadScriptVersion,
  loadScriptSections,
  loadSelectedStory,
  loadStoryBeats,
  nextVersionNumber,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/**
 * Edit planner (Phase 8). Builds a deterministic Edit Decision List from the
 * selected story's beats, the script sections, the source ranges, and the
 * channel's enumerated edit_style tokens. No AI provider — pure timeline
 * assembly. Writes edit_versions + edit_segments and hands off to render.
 * Pipeline stage: building_edit (stays until render starts).
 */
export const editPlanning: JobHandler = async (job, ctx) => {
  await ctx.heartbeat({
    stage: "building_edit",
    activity: "Planning the edit",
  });

  const story = await loadSelectedStory(job.project_id);
  if (!story) {
    throw new JobError("EDIT_NO_STORY", "No selected story to edit.", {
      retryable: false,
    });
  }

  const beatRows = await loadStoryBeats(story.id);
  if (beatRows.length === 0) {
    throw new JobError("EDIT_NO_BEATS", "The story has no moments to edit.", {
      retryable: false,
    });
  }

  // Use the script version this run was enqueued for (the one that was
  // narrated) — "latest" could be a newer, unnarrated regeneration whose
  // sections have no audio, which would silently render without narration.
  const payload = job.payload as { script_version_id?: string };
  const script = payload.script_version_id
    ? await loadScriptVersion(payload.script_version_id)
    : await loadLatestScriptVersion(job.project_id);
  const sections = script ? await loadScriptSections(script.id) : [];
  const settings = await loadActiveCreativeSettings(job.project_id);
  const source = await loadOriginalSource(job.project_id);

  // Pair beats with script sections by order when the counts line up; the
  // script writer produced one section per beat in the same order.
  const pairSections = sections.length === beatRows.length;
  const beats: EdlBeat[] = beatRows.map((b, index) => ({
    storyRole: b.story_role,
    sortOrder: b.sort_order,
    momentType: b.moment.moment_type,
    candidateMomentId: b.candidate_moment_id,
    scriptSectionId: pairSections ? (sections[index]?.id ?? null) : null,
    sourceStartMs: b.moment.start_ms,
    sourceEndMs: b.moment.end_ms,
  }));

  // Coverage-first: the timeline is the whole match; ALL analysed moments
  // are kept (not just the story selection), and only long eventless
  // stretches get compressed. Requires the probed source duration.
  const allMoments = await loadCandidateMoments(job.project_id);

  const result = buildEdl({
    sourceAssetId: source?.id ?? null,
    sourceDurationMs: source?.duration_ms ?? null,
    keepRanges: allMoments.map((m) => ({
      startMs: m.start_ms,
      endMs: m.end_ms,
    })),
    editStyle: (settings?.edit_style ?? {}) as Record<string, unknown>,
    gameplayPreservation: settings?.gameplay_preservation ?? "balanced",
    beats,
  });

  if (result.segments.length === 0) {
    throw new JobError(
      "EDIT_EMPTY",
      "The edit plan produced no usable segments.",
      { retryable: false },
    );
  }

  const versionNumber = await nextVersionNumber("edit_versions", job.project_id);
  const editVersionId = await createEditVersion({
    project_id: job.project_id,
    story_version_id: story.id,
    script_version_id: script?.id ?? null,
    creative_settings_id: settings?.id ?? null,
    version_number: versionNumber,
    status: "ready",
    edl_schema_version: EDL_SCHEMA_VERSION,
    timeline_duration_ms: result.timelineDurationMs,
    summary: `${result.segments.length} segments, ${Math.round(result.timelineDurationMs / 1000)}s`,
    edl: result.edl,
    created_by_job_id: job.id,
  });

  await insertEditSegments(
    result.segments.map((segment) => ({
      project_id: job.project_id,
      edit_version_id: editVersionId,
      segment_index: segment.segmentIndex,
      segment_type: segment.segmentType,
      output_start_ms: segment.outputStartMs,
      output_end_ms: segment.outputEndMs,
      source_asset_id: segment.sourceAssetId,
      source_start_ms: segment.sourceStartMs,
      source_end_ms: segment.sourceEndMs,
      candidate_moment_id: segment.candidateMomentId,
      script_section_id: segment.scriptSectionId,
      included: true,
      effect_summary: segment.effectSummary,
      metadata: segment.metadata,
    })),
  );

  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "render",
    idempotencyKey: `render:${editVersionId}`,
    payload: { edit_version_id: editVersionId },
    parentJobId: job.id,
  });

  return {
    edit_version_id: editVersionId,
    segment_count: result.segments.length,
    timeline_duration_ms: result.timelineDurationMs,
  };
};
