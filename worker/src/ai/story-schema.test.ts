import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countCatchphrases,
  findForbiddenViolations,
} from "./context.js";
import {
  normalizeScriptResult,
  normalizeStoryResult,
} from "./story-schema.js";

test("normalizeStoryResult keeps valid selections and normalizes structure", () => {
  const result = normalizeStoryResult(
    {
      title: "  The Long Con  ",
      angle: "A slow-burn killer comeback.",
      summary: "Summary here.",
      structure: {
        hook: "Cold open on the mori.",
        turning_points: ["First down", "Gen regression", 42],
        payoff: "Everyone hooked.",
        junk: { nested: true },
      },
      selections: [
        { moment_index: 2, story_role: "climax", sort_order: 3 },
        { moment_index: 0, story_role: "hook", sort_order: 0 },
      ],
    },
    3,
  );

  assert.ok(result);
  assert.equal(result.title, "The Long Con");
  assert.deepEqual(result.structure.turning_points, ["First down", "Gen regression"]);
  assert.equal(result.structure.junk, undefined); // unknown keys dropped
  // sorted by sort_order
  assert.equal(result.selections[0]?.momentIndex, 0);
  assert.equal(result.selections[1]?.momentIndex, 2);
});

test("normalizeStoryResult drops out-of-range and duplicate selections", () => {
  const result = normalizeStoryResult(
    {
      title: "t",
      angle: "a",
      summary: "s",
      selections: [
        { moment_index: 5, story_role: "hook" }, // out of range (count 3)
        { moment_index: 1, story_role: "setup" },
        { moment_index: 1, story_role: "setup" }, // duplicate (index+role)
        { moment_index: 1, story_role: "climax" }, // same index, different role → kept
      ],
    },
    3,
  );
  assert.ok(result);
  assert.equal(result.selections.length, 2);
});

test("normalizeStoryResult returns null for non-object", () => {
  assert.equal(normalizeStoryResult(null, 3), null);
  assert.equal(normalizeStoryResult("x", 3), null);
});

test("normalizeScriptResult reindexes sections and joins full text", () => {
  const result = normalizeScriptResult(
    {
      sections: [
        { section_index: 5, start_ms: 8000, end_ms: 9000, text: "Second." },
        { section_index: 1, start_ms: 1000, end_ms: 2000, text: "First." },
        { section_index: 9, start_ms: 100, end_ms: 50, text: "" }, // no text → dropped
      ],
    },
    { durationMs: 60000 },
  );

  assert.ok(result);
  assert.equal(result.sections.length, 2);
  // reindexed 0..n-1 in (given index, start) order
  assert.equal(result.sections[0]?.sectionIndex, 0);
  assert.equal(result.sections[0]?.text, "First.");
  assert.equal(result.sections[1]?.sectionIndex, 1);
  assert.equal(result.fullText, "First.\n\nSecond.");
});

test("normalizeScriptResult repairs bad ranges and clamps to duration", () => {
  const result = normalizeScriptResult(
    {
      sections: [
        { section_index: 0, start_ms: 5000, end_ms: 5000, text: "A" }, // end<=start
        { section_index: 1, start_ms: 1000, end_ms: 999999, text: "B" }, // past duration
      ],
    },
    { durationMs: 10000 },
  );
  assert.ok(result);
  assert.equal(result.sections[0]?.endMs, 5001); // repaired to start+1
  assert.equal(result.sections[1]?.endMs, 10000); // clamped to duration
});

test("normalizeScriptResult returns null for non-object", () => {
  assert.equal(normalizeScriptResult(42), null);
});

test("findForbiddenViolations matches whole words and phrases, case-insensitive", () => {
  const text = "That was an EPIC play, truly insane value.";
  const hits = findForbiddenViolations(text, ["epic", "insane value", "boring"]);
  assert.deepEqual(hits.sort(), ["epic", "insane value"].sort());
});

test("findForbiddenViolations does not match inside larger words", () => {
  // "ass" must not match inside "class"; single words use word boundaries.
  const hits = findForbiddenViolations("A masterclass performance.", ["ass"]);
  assert.deepEqual(hits, []);
});

test("countCatchphrases counts occurrences for the budget", () => {
  // Matching is literal + case-insensitive; the period is part of the phrase.
  const text = "Textbook. Later: textbook. Let that sink in.";
  const counts = countCatchphrases(text, ["Textbook.", "Let that sink in."]);
  assert.equal(counts["Textbook."], 2); // "Textbook." and "textbook." (case-insensitive)
  assert.equal(counts["Let that sink in."], 1);
});

test("normalizeStoryResult re-sequences sort orders to 0..n-1", () => {
  const result = normalizeStoryResult(
    {
      title: "t",
      angle: "a",
      summary: "s",
      selections: [
        { moment_index: 0, story_role: "hook", sort_order: 5 },
        { moment_index: 1, story_role: "setup" }, // missing → sorts last
        { moment_index: 2, story_role: "climax", sort_order: 5 }, // duplicate value
      ],
    },
    3,
  );
  assert.ok(result);
  assert.deepEqual(
    result.selections.map((s) => s.momentIndex),
    [0, 2, 1],
  );
  // No duplicates or gaps may survive — later reads order by sort_order.
  assert.deepEqual(
    result.selections.map((s) => s.sortOrder),
    [0, 1, 2],
  );
});
