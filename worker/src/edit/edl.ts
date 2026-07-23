/**
 * Deterministic Edit Decision List (EDL) builder (Phase 8).
 *
 * Turns the ordered story beats (each a candidate moment + its narration
 * section) into a concrete, inspectable timeline: one gameplay segment per
 * beat, concatenated in narrative order. This is pure logic — no AI provider —
 * so it is fully unit-testable and needs no API key. Creative intent enters
 * only as ENUMERATED edit_style tokens and the gameplay_preservation dial;
 * the render engine (Phase 9) executes this plan without re-deciding anything.
 */

export const EDL_SCHEMA_VERSION = 1;

/** Per-clip max length (ms) implied by the gameplay_preservation dial. */
function clipCapMs(gameplayPreservation: string): number | null {
  switch (gameplayPreservation) {
    case "preserve_more":
      return null; // keep full moment
    case "cut_more_aggressively":
      return 10_000;
    default:
      return 20_000; // balanced
  }
}

/** One ordered beat: a candidate moment with its narration section. */
export type EdlBeat = {
  storyRole: string;
  sortOrder: number;
  momentType: string;
  candidateMomentId: string;
  scriptSectionId: string | null;
  sourceStartMs: number;
  sourceEndMs: number;
};

export type EdlInput = {
  sourceAssetId: string | null;
  /** Enumerated tokens: caption_style, zoom_usage, transition_style, intro/outro. */
  editStyle: Record<string, unknown>;
  gameplayPreservation: string;
  beats: EdlBeat[];
};

export type EdlSegment = {
  segmentIndex: number;
  segmentType: string;
  outputStartMs: number;
  outputEndMs: number;
  sourceAssetId: string | null;
  sourceStartMs: number;
  sourceEndMs: number;
  candidateMomentId: string;
  scriptSectionId: string | null;
  effectSummary: string;
  metadata: Record<string, unknown>;
};

export type EdlResult = {
  segments: EdlSegment[];
  timelineDurationMs: number;
  /** The inspectable jsonb plan stored on edit_versions.edl. */
  edl: Record<string, unknown>;
};

function token(editStyle: Record<string, unknown>, key: string, fallback: string): string {
  const value = editStyle[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** Build the EDL. Beats with a non-positive source range are skipped. */
export function buildEdl(input: EdlInput): EdlResult {
  const cap = clipCapMs(input.gameplayPreservation);

  const captionStyle = token(input.editStyle, "caption_style", "none");
  const zoomUsage = token(input.editStyle, "zoom_usage", "none");
  const transitionStyle = token(input.editStyle, "transition_style", "cut");

  const ordered = [...input.beats].sort((a, b) => a.sortOrder - b.sortOrder);

  const segments: EdlSegment[] = [];
  let cursor = 0;
  let segmentIndex = 0;

  for (const beat of ordered) {
    const start = Math.max(0, Math.round(beat.sourceStartMs));
    let end = Math.round(beat.sourceEndMs);
    if (!Number.isFinite(end) || end <= start) continue;
    if (cap !== null && end - start > cap) end = start + cap;

    const clipMs = end - start;
    const outputStartMs = cursor;
    const outputEndMs = cursor + clipMs;
    cursor = outputEndMs;

    segments.push({
      segmentIndex,
      segmentType: "gameplay",
      outputStartMs,
      outputEndMs,
      sourceAssetId: input.sourceAssetId,
      sourceStartMs: start,
      sourceEndMs: end,
      candidateMomentId: beat.candidateMomentId,
      scriptSectionId: beat.scriptSectionId,
      effectSummary: `caption:${captionStyle} zoom:${zoomUsage} transition:${transitionStyle}`,
      metadata: {
        story_role: beat.storyRole,
        moment_type: beat.momentType,
        caption_style: captionStyle,
        zoom_usage: zoomUsage,
        transition_style: transitionStyle,
      },
    });
    segmentIndex += 1;
  }

  const timelineDurationMs = cursor;

  const edl = {
    schema_version: EDL_SCHEMA_VERSION,
    gameplay_preservation: input.gameplayPreservation,
    clip_cap_ms: cap,
    edit_style: {
      caption_style: captionStyle,
      zoom_usage: zoomUsage,
      transition_style: transitionStyle,
      intro_style: token(input.editStyle, "intro_style", "none"),
      outro_style: token(input.editStyle, "outro_style", "none"),
    },
    segment_count: segments.length,
    timeline_duration_ms: timelineDurationMs,
    segments: segments.map((s) => ({
      index: s.segmentIndex,
      type: s.segmentType,
      output_start_ms: s.outputStartMs,
      output_end_ms: s.outputEndMs,
      source_start_ms: s.sourceStartMs,
      source_end_ms: s.sourceEndMs,
      story_role: s.metadata.story_role,
      candidate_moment_id: s.candidateMomentId,
      script_section_id: s.scriptSectionId,
    })),
  };

  return { segments, timelineDurationMs, edl };
}
