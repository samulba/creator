import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAssDocument, buildCaptionCues } from "./captions.js";

test("buildCaptionCues chunks long sections and keeps cues inside the slot", () => {
  const cues = buildCaptionCues([
    {
      text: "That pallet drop was pure panic and honestly it saved the whole chase for me",
      startMs: 10_000,
      maxDurationMs: 8_000,
    },
  ]);

  assert.ok(cues.length >= 2, "long text splits into multiple cues");
  assert.equal(cues[0]?.startMs, 10_000);
  for (const cue of cues) {
    assert.ok(cue.endMs > cue.startMs);
    assert.ok(cue.endMs <= 18_000, "cue never leaves the narration slot");
    assert.ok(cue.text.split(" ").length <= 6, "max 6 words per cue");
  }
  // Sequential, non-overlapping.
  for (let i = 1; i < cues.length; i += 1) {
    assert.ok(cues[i]!.startMs >= cues[i - 1]!.endMs);
  }
});

test("buildCaptionCues drops empty sections and sorts by time", () => {
  const cues = buildCaptionCues([
    { text: "   ", startMs: 0, maxDurationMs: 5_000 },
    { text: "Second line", startMs: 20_000, maxDurationMs: 5_000 },
    { text: "First line", startMs: 5_000, maxDurationMs: 5_000 },
  ]);
  assert.equal(cues.length, 2);
  assert.equal(cues[0]?.text, "First line");
  assert.equal(cues[1]?.text, "Second line");
});

test("buildAssDocument produces a valid ASS structure with animations", () => {
  const doc = buildAssDocument(
    [{ text: "No gen for you {sorry}", startMs: 1_000, endMs: 3_500 }],
    "expressive",
  );

  assert.ok(doc.includes("[Script Info]"));
  assert.ok(doc.includes("PlayResX: 1920"));
  assert.ok(doc.includes("Style: Creator,DejaVu Sans,"));
  assert.ok(doc.includes("Dialogue: 0,0:00:01.00,0:00:03.50,Creator"));
  // Pop-in animation present for expressive.
  assert.ok(doc.includes("\\fscx82"));
  // Braces are stripped so the text cannot open an override block.
  assert.ok(doc.includes("No gen for you sorry"));
  assert.ok(!doc.includes("{sorry}"));
});

test("buildAssDocument styles differ per caption style", () => {
  const minimal = buildAssDocument(
    [{ text: "hi", startMs: 0, endMs: 1_000 }],
    "minimal",
  );
  const standard = buildAssDocument(
    [{ text: "hi", startMs: 0, endMs: 1_000 }],
    "standard",
  );
  assert.ok(minimal.includes(",44,"));
  assert.ok(standard.includes(",52,"));
  assert.ok(!minimal.includes("\\fscx82"));
});
