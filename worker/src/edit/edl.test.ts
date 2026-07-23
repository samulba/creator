import assert from "node:assert/strict";
import { test } from "node:test";

import { buildEdl, type EdlBeat } from "./edl.js";

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

test("buildEdl caps clip length for aggressive cutting", () => {
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
  const aggressive = buildEdl({
    sourceAssetId: "a",
    editStyle: {},
    gameplayPreservation: "cut_more_aggressively",
    beats: long,
  });
  assert.equal(aggressive.segments[0]?.sourceEndMs, 10000); // capped to 10s
  assert.equal(aggressive.timelineDurationMs, 10000);

  const preserve = buildEdl({
    sourceAssetId: "a",
    editStyle: {},
    gameplayPreservation: "preserve_more",
    beats: long,
  });
  assert.equal(preserve.segments[0]?.sourceEndMs, 60000); // uncapped
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
  assert.equal(style.transition_style, "cut");
  assert.equal(result.edl.schema_version, 1);
});
