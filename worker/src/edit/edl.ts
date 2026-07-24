/**
 * Deterministic Edit Decision List (EDL) builder (Phase 8).
 *
 * COVERAGE-FIRST: the timeline is the WHOLE match in chronological order —
 * this is a long-form gameplay video, not a highlight short. Only long,
 * eventless stretches are compressed (how hard depends on the
 * gameplay_preservation dial); every analysed moment is always kept. Story
 * beats attach narration at the exact spot their moment appears.
 *
 * This is pure logic — no AI provider — so it is fully unit-testable. The
 * render engine (Phase 9) executes this plan without re-deciding anything.
 * A legacy beats-only path remains for sources with unknown duration.
 */

export const EDL_SCHEMA_VERSION = 2;

/** How much uneventful footage survives, per gameplay_preservation. */
function coverageParams(gameplayPreservation: string): {
  /** Gaps up to this long are kept in full (connective play). */
  maxGapKeepMs: number;
  /** For longer gaps: keep this much of its head and tail. */
  gapEdgeKeepMs: number;
  /** Padding around each kept moment. */
  momentPadMs: number;
} {
  switch (gameplayPreservation) {
    case "preserve_more":
      return { maxGapKeepMs: 60_000, gapEdgeKeepMs: 10_000, momentPadMs: 2_000 };
    case "cut_more_aggressively":
      return { maxGapKeepMs: 12_000, gapEdgeKeepMs: 4_000, momentPadMs: 1_500 };
    default:
      return { maxGapKeepMs: 30_000, gapEdgeKeepMs: 6_000, momentPadMs: 2_000 };
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
  /** Full source duration; null falls back to the legacy beats-only cut. */
  sourceDurationMs?: number | null;
  /** Every analysed moment range — all are kept, selected or not. */
  keepRanges?: Array<{ startMs: number; endMs: number }>;
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
  candidateMomentId: string | null;
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

function token(
  editStyle: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = editStyle[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

type Range = { startMs: number; endMs: number };

/** Sorts, clamps to the source, and merges overlapping/touching ranges. */
function mergeRanges(ranges: Range[], durationMs: number): Range[] {
  const cleaned = ranges
    .map((r) => ({
      startMs: Math.max(0, Math.round(r.startMs)),
      endMs: Math.min(durationMs, Math.round(r.endMs)),
    }))
    .filter((r) => r.endMs > r.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const merged: Range[] = [];
  for (const range of cleaned) {
    const last = merged[merged.length - 1];
    if (last && range.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, range.endMs);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * The chronological cut: every moment (padded) is kept; the gaps between
 * them survive in full when short, or shrink to head+tail when long. The
 * result is one merged, ordered list of source ranges.
 */
export function buildCoverageCut(
  durationMs: number,
  momentRanges: Range[],
  gameplayPreservation: string,
): Range[] {
  const params = coverageParams(gameplayPreservation);

  const padded = momentRanges.map((r) => ({
    startMs: r.startMs - params.momentPadMs,
    endMs: r.endMs + params.momentPadMs,
  }));
  const anchors = mergeRanges(padded, durationMs);
  if (anchors.length === 0) {
    // Nothing analysed — keep the entire match untouched.
    return [{ startMs: 0, endMs: durationMs }];
  }

  const kept: Range[] = [];
  const keepGap = (gapStart: number, gapEnd: number) => {
    const gap = gapEnd - gapStart;
    if (gap <= 0) return;
    if (gap <= params.maxGapKeepMs) {
      kept.push({ startMs: gapStart, endMs: gapEnd });
      return;
    }
    // Long dead stretch: keep the head and tail so the progression stays
    // visible, drop the middle.
    kept.push({ startMs: gapStart, endMs: gapStart + params.gapEdgeKeepMs });
    kept.push({ startMs: gapEnd - params.gapEdgeKeepMs, endMs: gapEnd });
  };

  keepGap(0, anchors[0]!.startMs);
  for (let i = 0; i < anchors.length; i += 1) {
    kept.push(anchors[i]!);
    const next = anchors[i + 1];
    keepGap(anchors[i]!.endMs, next ? next.startMs : durationMs);
  }

  return mergeRanges(kept, durationMs);
}

/** Build the EDL. Beats with a non-positive source range are skipped. */
export function buildEdl(input: EdlInput): EdlResult {
  const captionStyle = token(input.editStyle, "caption_style", "standard");
  const zoomUsage = token(input.editStyle, "zoom_usage", "none");
  const transitionStyle = token(input.editStyle, "transition_style", "subtle");
  const effectSummary = `caption:${captionStyle} zoom:${zoomUsage} transition:${transitionStyle}`;
  const styleMetadata = {
    caption_style: captionStyle,
    zoom_usage: zoomUsage,
    transition_style: transitionStyle,
  };

  const validBeats = input.beats.filter(
    (b) =>
      Number.isFinite(b.sourceEndMs) &&
      Math.round(b.sourceEndMs) > Math.max(0, Math.round(b.sourceStartMs)),
  );

  let cut: Range[];
  let mode: "coverage" | "beats_only";
  if (input.sourceDurationMs && input.sourceDurationMs > 0) {
    mode = "coverage";
    const momentRanges: Range[] = [
      ...(input.keepRanges ?? []),
      ...validBeats.map((b) => ({
        startMs: b.sourceStartMs,
        endMs: b.sourceEndMs,
      })),
    ];
    cut = buildCoverageCut(
      input.sourceDurationMs,
      momentRanges,
      input.gameplayPreservation,
    );
  } else {
    // Legacy fallback: no known duration → play the beats chronologically.
    mode = "beats_only";
    cut = mergeRanges(
      validBeats.map((b) => ({ startMs: b.sourceStartMs, endMs: b.sourceEndMs })),
      Number.MAX_SAFE_INTEGER,
    );
  }

  // Narration anchors: split the cut at each narrated beat's start so its
  // narration begins exactly when the moment appears on the output timeline.
  const anchors = validBeats
    .filter((b) => b.scriptSectionId !== null)
    .map((b) => ({
      atMs: Math.max(0, Math.round(b.sourceStartMs)),
      beat: b,
    }))
    .sort((a, b) => a.atMs - b.atMs);

  const boundaries = new Set<number>();
  for (const anchor of anchors) boundaries.add(anchor.atMs);

  const pieces: Range[] = [];
  for (const range of cut) {
    const inner = [...boundaries]
      .filter((at) => at > range.startMs && at < range.endMs)
      .sort((a, b) => a - b);
    let position = range.startMs;
    for (const at of inner) {
      pieces.push({ startMs: position, endMs: at });
      position = at;
    }
    pieces.push({ startMs: position, endMs: range.endMs });
  }

  const segments: EdlSegment[] = [];
  let cursor = 0;
  for (const piece of pieces) {
    const clipMs = piece.endMs - piece.startMs;
    if (clipMs <= 0) continue;
    const anchor = anchors.find((a) => a.atMs === piece.startMs) ?? null;
    const beat =
      anchor?.beat ??
      validBeats.find(
        (b) => b.sourceStartMs < piece.endMs && b.sourceEndMs > piece.startMs,
      ) ??
      null;

    segments.push({
      segmentIndex: segments.length,
      segmentType: "gameplay",
      outputStartMs: cursor,
      outputEndMs: cursor + clipMs,
      sourceAssetId: input.sourceAssetId,
      sourceStartMs: piece.startMs,
      sourceEndMs: piece.endMs,
      candidateMomentId: beat?.candidateMomentId ?? null,
      scriptSectionId: anchor?.beat.scriptSectionId ?? null,
      effectSummary,
      metadata: {
        story_role: beat?.storyRole ?? "context",
        moment_type: beat?.momentType ?? "connective",
        ...styleMetadata,
      },
    });
    cursor += clipMs;
  }

  const timelineDurationMs = cursor;

  const edl = {
    schema_version: EDL_SCHEMA_VERSION,
    mode,
    gameplay_preservation: input.gameplayPreservation,
    source_duration_ms: input.sourceDurationMs ?? null,
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
