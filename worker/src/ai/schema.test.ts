import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCoarsePrompt,
  buildCreativeContext,
  buildPersonaContext,
  characterConfigHash,
} from "./context.js";
import { normalizeCoarseResult, PROMPT_TEMPLATE_VERSION } from "./schema.js";
import type { CharacterRow, CreativeSettingsRow } from "../types.js";

const character: CharacterRow = {
  id: "char-1",
  user_id: "user-1",
  name: "The Archivist",
  language: "en",
  voice_provider: "elevenlabs",
  voice_key: "voice-abc",
  voice_settings: { model_id: "eleven_v3", stability: 0.4 },
  speech_style: {
    tone: "dry, deadpan",
    humor_level: "high",
    energy: "measured",
    catchphrases: ["Let that sink in.", "Textbook."],
    forbidden_words: ["epic", "insane"],
  },
};

const settings: CreativeSettingsRow = {
  id: "s1",
  project_id: "p1",
  version_number: 1,
  creative_direction: "funnier",
  pacing: "tight",
  narration_density: "detailed",
  gameplay_preservation: "cut_more_aggressively",
  target_length: "standard",
  character_id: "char-1",
  edit_style: {},
  is_active: true,
};

test("normalizeCoarseResult keeps valid events and moments", () => {
  const result = normalizeCoarseResult(
    {
      summary: "  A tense killer match.  ",
      match_context: { role: "killer", map: "Badham" },
      events: [
        { event_type: "chase_start", start_ms: 1000, end_ms: 5000, confidence: 0.9, importance: 70 },
        { event_type: "hook", start_ms: 6000, end_ms: 6500, importance: 80 },
      ],
      moments: [
        {
          moment_type: "clutch_chase",
          start_ms: 1000,
          end_ms: 6500,
          importance: 90,
          selection_reason: "High-tension opener",
          supporting_event_indices: [0, 1],
        },
      ],
    },
    { durationMs: 600_000 },
  );

  assert.ok(result);
  assert.equal(result.summary, "A tense killer match.");
  assert.equal(result.matchContext.role, "killer");
  assert.equal(result.events.length, 2);
  assert.equal(result.moments.length, 1);
  assert.deepEqual(result.moments[0]?.supportingEventIndices, [0, 1]);
});

test("normalizeCoarseResult drops malformed events", () => {
  const result = normalizeCoarseResult({
    summary: null,
    events: [
      { event_type: "", start_ms: 0, end_ms: 100 }, // empty type
      { event_type: "ok", start_ms: 500, end_ms: 100 }, // end <= start
      { event_type: "good", start_ms: 200, end_ms: 900 }, // valid
      { start_ms: 1, end_ms: 2 }, // missing type
    ],
    moments: [],
  });

  assert.ok(result);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.eventType, "good");
});

test("normalizeCoarseResult clamps ranges and confidence to constraints", () => {
  const result = normalizeCoarseResult(
    {
      summary: "x",
      events: [
        { event_type: "late", start_ms: 100, end_ms: 999_999, confidence: 5, importance: 500 },
      ],
      moments: [],
    },
    { durationMs: 10_000 },
  );

  assert.ok(result);
  const event = result.events[0];
  assert.ok(event);
  assert.equal(event.endMs, 10_000); // clamped to duration
  assert.equal(event.confidence, 1); // clamped to [0,1]
  assert.equal(event.importance, 100); // clamped to [0,100]
});

test("normalizeCoarseResult rejects events starting past the footage", () => {
  const result = normalizeCoarseResult(
    {
      summary: "x",
      events: [{ event_type: "ghost", start_ms: 50_000, end_ms: 51_000 }],
      moments: [],
    },
    { durationMs: 10_000 },
  );
  assert.ok(result);
  assert.equal(result.events.length, 0);
});

test("normalizeCoarseResult strips moment links that reference missing events", () => {
  const result = normalizeCoarseResult({
    summary: "x",
    events: [{ event_type: "only", start_ms: 0, end_ms: 100 }],
    moments: [
      {
        moment_type: "m",
        start_ms: 0,
        end_ms: 100,
        supporting_event_indices: [0, 7, -1, 0],
      },
    ],
  });
  assert.ok(result);
  // 7 and -1 are out of range; duplicate 0 is de-duped.
  assert.deepEqual(result.moments[0]?.supportingEventIndices, [0]);
});

test("normalizeCoarseResult returns null for non-object input", () => {
  assert.equal(normalizeCoarseResult(null), null);
  assert.equal(normalizeCoarseResult("nope"), null);
  assert.equal(normalizeCoarseResult(42), null);
});

test("normalizeCoarseResult tolerates missing arrays", () => {
  const result = normalizeCoarseResult({ summary: "only summary" });
  assert.ok(result);
  assert.equal(result.events.length, 0);
  assert.equal(result.moments.length, 0);
});

test("characterConfigHash is stable and key-order independent", () => {
  const a = characterConfigHash(character);
  const reordered: CharacterRow = {
    ...character,
    speech_style: {
      forbidden_words: ["epic", "insane"],
      energy: "measured",
      humor_level: "high",
      tone: "dry, deadpan",
      catchphrases: ["Let that sink in.", "Textbook."],
    },
  };
  const b = characterConfigHash(reordered);
  assert.equal(a, b);
  assert.match(a ?? "", /^[a-f0-9]{64}$/);
});

test("characterConfigHash changes when the persona changes", () => {
  const changed: CharacterRow = {
    ...character,
    speech_style: { ...character.speech_style, tone: "hyped, loud" },
  };
  assert.notEqual(characterConfigHash(character), characterConfigHash(changed));
});

test("characterConfigHash is null without a character", () => {
  assert.equal(characterConfigHash(null), null);
});

test("buildPersonaContext distils speech_style", () => {
  const persona = buildPersonaContext(character, "de");
  assert.equal(persona.characterId, "char-1");
  assert.equal(persona.language, "en"); // character language wins
  assert.equal(persona.tone, "dry, deadpan");
  assert.deepEqual(persona.forbiddenWords, ["epic", "insane"]);
  assert.ok(persona.configHash);
});

test("buildPersonaContext falls back to project language without a character", () => {
  const persona = buildPersonaContext(null, "de");
  assert.equal(persona.language, "de");
  assert.equal(persona.characterId, null);
  assert.equal(persona.configHash, null);
});

test("buildCreativeContext applies balanced defaults", () => {
  const creative = buildCreativeContext(null);
  assert.equal(creative.creativeDirection, "balanced");
  assert.equal(creative.targetLength, "auto");
});

test("buildCoarsePrompt grounds the request and includes persona + dials", () => {
  const persona = buildPersonaContext(character, "en");
  const creative = buildCreativeContext(settings);
  const prompt = buildCoarsePrompt({
    projectTitle: "Nightmare on Badham",
    proxyUrl: "https://example/proxy.mp4",
    proxyObjectKey: "k",
    proxyMimeType: "video/mp4",
    durationMs: 600_000,
    persona,
    creative,
  });

  assert.match(prompt, /Nightmare on Badham/);
  assert.match(prompt, /The Archivist/);
  assert.match(prompt, /funnier/);
  assert.match(prompt, /Never fabricate/);
  assert.match(prompt, new RegExp(PROMPT_TEMPLATE_VERSION));
});
