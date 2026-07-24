import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCoverageCut, buildEdl, type EdlBeat } from "./edl.js";

const beats: EdlBeat[] = [
  {
    storyRole: "hook",
    sortOrder: 0,
    momentType: "clutch",
    candidateMomentId: "m0",
    scriptSectionId: "s0",
    sourceStartMs: 1000,
    sourceEndMs: 5000, // 4s
  },
  {
    storyRole: "climax",
    sortOrder: 1,
    momentType: "mori",
    candidateMomentId: "m1",
    scriptSectionId: "s1",
    sourceStartMs: 20000,
    sourceEndMs: 23000, // 3s
  },
];

test("buildEdl concatenates beats into a contiguous timeline", () => {
  const result = buildEdl({
    sourceAssetId: "asset-1",
    editStyle: { caption_style: "bold", zoom_usage: "occasional", transition_style: "hard_cut" },
    gameplayPreservation: "balanced",
    beats,
  });

  assert.equal(result.segments.length, 2);
  assert.equal(result.timelineDurationMs, 7000); // 4s + 3s

  const [a, b] = result.segments;
  assert.equal(a?.outputStartMs, 0);
  assert.equal(a?.outputEndMs, 4000);
  assert.equal(a?.sourceStartMs, 1000);
  assert.equal(a?.sourceEndMs, 5000);
  // contiguous: second starts where the first ends
  assert.equal(b?.outputStartMs, 4000);
  assert.equal(b?.outputEndMs, 7000);
  assert.match(a?.effectSummary ?? "", /caption:bold/);
});

test("buildEdl respects the ordered beats and reindexes segments", () => {
  const reversed = [beats[1]!, beats[0]!]; // out of order input
  const result = buildEdl({
    sourceAssetId: "asset-1",
    editStyle: {},
    gameplayPreservation: "preserve_more",
    beats: reversed,
  });
  // sorted by sortOrder → hook (m0) first
  assert.equal(result.segments[0]?.candidateMomentId, "m0");
  assert.equal(result.segments[0]?.segmentIndex, 0);
  assert.equal(result.segments[1]?.segmentIndex, 1);
});

test("buildEdl legacy fallback keeps full beats in chronological order", () => {
  const long: EdlBeat[] = [
    {
      storyRole: "setup",
      sortOrder: 0,
      momentType: "chase",
      candidateMomentId: "m0",
      scriptSectionId: null,
      sourceStartMs: 0,
      sourceEndMs: 60000, // 60s
    },
  ];
  // No source duration -> beats-only fallback; moments are never capped.
  const aggressive = buildEdl({
    sourceAssetId: "a",
    editStyle: {},
    gameplayPreservation: "cut_more_aggressively",
    beats: long,
  });
  assert.equal(aggressive.segments[0]?.sourceEndMs, 60000);
  assert.equal(aggressive.timelineDurationMs, 60000);
});

test("buildCoverageCut keeps short gaps and compresses long ones", () => {
  // Two moments with a short gap (kept) and a long tail gap (head+tail only).
  const cut = buildCoverageCut(
    300_000,
    [
      { startMs: 10_000, endMs: 20_000 },
      { startMs: 40_000, endMs: 50_000 },
    ],
    "balanced", // maxGapKeep 30s, edges 6s, pad 2s
  );
  // 0..8s lead-in is a short gap -> kept, merged with padded moment 8..22s,
  // gap 22..38s (16s <= 30s) kept, moment 38..52s kept, and the long tail
  // gap keeps its 6s head (52..58s), merging into one range 0..58s.
  assert.deepEqual(cut[0], { startMs: 0, endMs: 58_000 });
  // Tail gap 52..300s is long: head 52..58s stays merged, tail 294..300s.
  assert.equal(cut.length, 2);
  assert.deepEqual(cut[1], { startMs: 294_000, endMs: 300_000 });
});

test("buildCoverageCut keeps the whole match when nothing was analysed", () => {
  const cut = buildCoverageCut(120_000, [], "cut_more_aggressively");
  assert.deepEqual(cut, [{ startMs: 0, endMs: 120_000 }]);
});

test("buildEdl coverage mode splits at narrated moments and stays chronological", () => {
  const result = buildEdl({
    sourceAssetId: "a",
    sourceDurationMs: 100_000,
    keepRanges: [{ startMs: 5_000, endMs: 95_000 }],
    editStyle: {},
    gameplayPreservation: "balanced",
    beats: [
      // Story order deliberately reversed vs chronology.
      {
        storyRole: "climax",
        sortOrder: 0,
        momentType: "down",
        candidateMomentId: "m-late",
        scriptSectionId: "s-late",
        sourceStartMs: 60_000,
        sourceEndMs: 70_000,
      },
      {
        storyRole: "hook",
        sortOrder: 1,
        momentType: "chase",
        candidateMomentId: "m-early",
        scriptSectionId: "s-early",
        sourceStartMs: 20_000,
        sourceEndMs: 30_000,
      },
    ],
  });

  // Full coverage: lead-in + moments + connective + tail are all present.
  assert.equal(result.timelineDurationMs, 100_000);

  // Output plays in source order regardless of story sort_order.
  const starts = result.segments.map((s) => s.sourceStartMs);
  assert.deepEqual([...starts].sort((x, y) => x - y), starts);

  // Narration is anchored exactly where its moment starts.
  const early = result.segments.find((s) => s.scriptSectionId === "s-early");
  const late = result.segments.find((s) => s.scriptSectionId === "s-late");
  assert.equal(early?.sourceStartMs, 20_000);
  assert.equal(late?.sourceStartMs, 60_000);
  assert.equal(early?.outputStartMs, 20_000);
  assert.equal(late?.outputStartMs, 60_000);
});

test("buildEdl skips beats with an invalid source range", () => {
  const result = buildEdl({
    sourceAssetId: "a",
    editStyle: {},
    gameplayPreservation: "balanced",
    beats: [
      { storyRole: "x", sortOrder: 0, momentType: "t", candidateMomentId: "m0", scriptSectionId: null, sourceStartMs: 500, sourceEndMs: 500 },
      { storyRole: "y", sortOrder: 1, momentType: "t", candidateMomentId: "m1", scriptSectionId: null, sourceStartMs: 100, sourceEndMs: 900 },
    ],
  });
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0]?.candidateMomentId, "m1");
});

test("buildEdl records enumerated edit_style tokens with defaults", () => {
  const result = buildEdl({
    sourceAssetId: "a",
    editStyle: { caption_style: "minimal" },
    gameplayPreservation: "balanced",
    beats,
  });
  const style = result.edl.edit_style as Record<string, string>;
  assert.equal(style.caption_style, "minimal");
  assert.equal(style.zoom_usage, "none"); // default when absent
  assert.equal(style.transition_style, "subtle");
  assert.equal(result.edl.schema_version, 2);
});
