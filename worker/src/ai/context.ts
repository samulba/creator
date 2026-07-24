/**
 * Turns a project's Character + creative settings into the grounded context
 * a coarse analysis prompt needs, and a stable hash of the resolved persona.
 *
 * The persona does NOT put words in the model's mouth here — coarse analysis
 * must report what is factually on screen. Persona and creative dials only
 * bias which moments are worth surfacing and how titles are framed. The real
 * narration voice is applied later (story/script phases), where the frozen
 * character config is what guarantees per-channel consistency.
 */

import { createHash } from "node:crypto";

import type { CharacterRow, CreativeSettingsRow } from "../types.js";

import { PROMPT_TEMPLATE_VERSION } from "./schema.js";
import {
  SCRIPT_PROMPT_VERSION,
  STORY_PROMPT_VERSION,
} from "./story-schema.js";
import type {
  CoarseAnalysisInput,
  CreativeContext,
  PersonaContext,
  ScriptGenerationInput,
  StoryGenerationInput,
} from "./types.js";

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function strList(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = str(item);
    if (s && !out.includes(s) && out.length < max) out.push(s);
  }
  return out;
}

/**
 * Deterministic JSON with recursively sorted keys, so the same persona always
 * hashes to the same value regardless of column ordering.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = canonicalize(record[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Stable hash of the resolved character configuration. Recorded on the
 * analysis run so a generated video's provenance ties back to an exact
 * persona version — later edits to the character never silently rewrite what
 * an existing video was built from.
 */
export function characterConfigHash(character: CharacterRow | null): string | null {
  if (!character) return null;
  const canonical = canonicalize({
    name: character.name,
    language: character.language,
    voice_provider: character.voice_provider,
    voice_key: character.voice_key,
    voice_settings: character.voice_settings ?? {},
    speech_style: character.speech_style ?? {},
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function buildPersonaContext(
  character: CharacterRow | null,
  fallbackLanguage: string,
): PersonaContext {
  const style = (character?.speech_style ?? {}) as Record<string, unknown>;
  return {
    characterId: character?.id ?? null,
    name: character ? str(character.name) : null,
    language: str(character?.language) ?? fallbackLanguage,
    tone: str(style.tone),
    humorLevel: str(style.humor_level),
    energy: str(style.energy),
    sentenceLength: str(style.sentence_length),
    vocabularyNotes: str(style.vocabulary_notes),
    catchphrases: strList(style.catchphrases),
    forbiddenWords: strList(style.forbidden_words),
    exampleLines: strList(style.example_lines, 20),
    configHash: characterConfigHash(character),
  };
}

export function buildCreativeContext(
  settings: CreativeSettingsRow | null,
): CreativeContext {
  return {
    creativeDirection: settings?.creative_direction ?? "balanced",
    pacing: settings?.pacing ?? "balanced",
    narrationDensity: settings?.narration_density ?? "balanced",
    gameplayPreservation: settings?.gameplay_preservation ?? "balanced",
    targetLength: settings?.target_length ?? "auto",
  };
}

function formatMs(durationMs: number | null): string {
  if (durationMs === null || durationMs <= 0) return "unknown";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s (${durationMs} ms)`;
}

/**
 * Assembles the coarse-analysis instruction. Deliberately explicit about
 * grounding (no invention), the millisecond time base, and how the creative
 * dials should influence importance — not fabrication.
 */
export function buildCoarsePrompt(input: CoarseAnalysisInput): string {
  const { persona, creative } = input;

  const personaLines: string[] = [];
  if (persona.name) personaLines.push(`- Narrator persona: ${persona.name}`);
  if (persona.tone) personaLines.push(`- Tone: ${persona.tone}`);
  if (persona.humorLevel) personaLines.push(`- Humor level: ${persona.humorLevel}`);
  if (persona.energy) personaLines.push(`- Energy: ${persona.energy}`);
  if (persona.catchphrases.length)
    personaLines.push(`- Signature phrases (context only): ${persona.catchphrases.join("; ")}`);
  const personaBlock = personaLines.length
    ? personaLines.join("\n")
    : "- No specific narrator persona configured.";

  return [
    "You are a Dead by Daylight gameplay analyst preparing raw footage for a",
    "long-form YouTube edit. Watch the attached gameplay proxy and report what",
    "actually happens, grounded strictly in what is visible on screen.",
    "",
    `Project: ${input.projectTitle}`,
    `Footage duration: ${formatMs(input.durationMs)}`,
    `Language for any text you write: ${persona.language}`,
    "",
    "Channel creative direction (bias for importance and selection only — never",
    "invent events to fit it):",
    `- Creative direction: ${creative.creativeDirection}`,
    `- Pacing: ${creative.pacing}`,
    `- Narration density: ${creative.narrationDensity}`,
    `- Gameplay preservation: ${creative.gameplayPreservation}`,
    `- Target length: ${creative.targetLength}`,
    "",
    "Narrator context (affects framing/titles, NOT the facts you report):",
    personaBlock,
    "",
    "Return two lists:",
    "1) events — every meaningful gameplay beat (chases, hooks, generator",
    "   progress, escapes, downs, mori, clutch plays, mistakes, funny moments).",
    "   Each event needs a short snake_case event_type, precise start_ms and",
    "   end_ms integer timestamps measured from the start of THIS footage, an",
    "   optional confidence 0..1, and an importance 0..100.",
    "2) moments — the segments most worth keeping in the final edit, each citing",
    "   the indices of the supporting events (0-based into your events list) and",
    "   a one-line selection_reason.",
    "",
    "Rules:",
    "- Ground everything in the footage. If you are unsure, lower the confidence",
    "  or omit it. Never fabricate events, kills, or names you cannot see.",
    "- Timestamps are integer milliseconds and must fall within the footage.",
    "- Keep titles and summaries factual and concise; do not write narration.",
    `- Respond ONLY as JSON matching the provided schema (template ${PROMPT_TEMPLATE_VERSION}).`,
  ].join("\n");
}

function personaBlock(persona: PersonaContext): string {
  const lines: string[] = [];
  if (persona.name) lines.push(`- Narrator: ${persona.name}`);
  if (persona.tone) lines.push(`- Tone: ${persona.tone}`);
  if (persona.humorLevel) lines.push(`- Humor level: ${persona.humorLevel}`);
  if (persona.energy) lines.push(`- Energy: ${persona.energy}`);
  if (persona.sentenceLength)
    lines.push(`- Sentence length: ${persona.sentenceLength}`);
  if (persona.vocabularyNotes)
    lines.push(`- Vocabulary notes: ${persona.vocabularyNotes}`);
  return lines.length ? lines.join("\n") : "- No specific narrator persona.";
}

function momentLine(m: {
  index: number;
  momentType: string;
  startMs: number;
  endMs: number;
  importance: number | null;
  title: string | null;
  summary: string | null;
}): string {
  const secs = (ms: number) => (ms / 1000).toFixed(1);
  const imp = m.importance === null ? "?" : Math.round(m.importance);
  const label = m.title ?? m.summary ?? m.momentType;
  return `  [${m.index}] ${secs(m.startMs)}–${secs(m.endMs)}s (imp ${imp}) ${m.momentType}: ${label}`;
}

/** Story director prompt: choose an angle grounded in the actual moments. */
export function buildStoryPrompt(input: StoryGenerationInput): string {
  const { persona, creative } = input;
  return [
    "You are the story director for a long-form Dead by Daylight YouTube",
    "video. From the analysis below, choose the single strongest narrative",
    "angle that is TRUE to what actually happened — never invent events.",
    "",
    `Project: ${input.projectTitle}`,
    `Language for text you write: ${input.language}`,
    "",
    "Match summary (from analysis):",
    input.analysisSummary ?? "(none)",
    "",
    "Creative direction (bias only — do not fabricate):",
    `- Direction: ${creative.creativeDirection}; pacing: ${creative.pacing};`,
    `  narration density: ${creative.narrationDensity}; length: ${creative.targetLength}`,
    "",
    "Narrator context (affects framing, not facts):",
    personaBlock(persona),
    "",
    "Candidate moments (index in brackets — reference these indices):",
    ...input.moments.map(momentLine),
    "",
    "IMPORTANT — this is a LONG-FORM video that shows the whole match from",
    "start to finish in chronological order. Your selections do not cut the",
    "video down; they decide WHERE narration happens. So:",
    "- Select generously: cover the entire match, early game to end, not just",
    "  the spectacular parts. 8–14 selections for a normal match.",
    "- sort_order MUST follow chronological order (earliest moment first).",
    "- The story arc comes from framing the real chronology, never from",
    "  reordering or omitting what happened.",
    "",
    "Produce:",
    "- title, angle (one sentence), and a 2–4 sentence summary",
    "- structure: hook, setup, escalation, turning_points (array), climax, payoff",
    "- selections: which candidate moment indices to narrate, each with a",
    "  story_role (hook | setup | escalation | turning_point | climax | payoff |",
    "  context) and a chronological sort_order (0-based). Only reference indices",
    "  listed above.",
    "",
    `Respond ONLY as JSON matching the provided schema (template ${STORY_PROMPT_VERSION}).`,
  ].join("\n");
}

/** Script writer prompt: timestamp-aware narration in the character's voice. */
export function buildScriptPrompt(input: ScriptGenerationInput): string {
  const { persona, creative, story } = input;

  const anchorLines = persona.exampleLines.length
    ? persona.exampleLines.map((l) => `  • ${l}`).join("\n")
    : "  (none provided — infer a consistent voice from tone/energy above)";

  const forbidden = persona.forbiddenWords.length
    ? persona.forbiddenWords.join(", ")
    : "(none)";
  const catchphrases = persona.catchphrases.length
    ? persona.catchphrases.join("; ")
    : "(none)";

  const beatLines = input.beats.map((b) => {
    const secs = (ms: number) => (ms / 1000).toFixed(1);
    const label = b.title ?? b.summary ?? b.momentType;
    const budget = b.maxWords ? ` (max ${b.maxWords} words)` : "";
    return `  #${b.sortOrder} [${b.storyRole}] ${secs(b.startMs)}–${secs(b.endMs)}s${budget} — ${label}`;
  });

  return [
    "You are the player commentating over their OWN Dead by Daylight gameplay",
    "for a long-form YouTube video. You lived this match — you talk like a real",
    "person reacting, not like a narrator describing footage. Stay grounded in",
    "the gameplay; never invent events, kills, or names.",
    "",
    `Project: ${input.projectTitle}`,
    `Language: ${input.language}`,
    "",
    "Story framing (context, not a script to recite):",
    `- Title: ${story.title ?? "(untitled)"}`,
    `- Angle: ${story.angle ?? "(none)"}`,
    `- Summary: ${story.summary ?? "(none)"}`,
    "",
    "Narrator voice:",
    personaBlock(persona),
    "Voice anchor — match the rhythm and attitude of these example lines closely:",
    anchorLines,
    "",
    "HOW TO SOUND HUMAN (as important as the facts):",
    "- Spoken language: contractions, short sentences, sentence fragments are",
    "  fine. Write it the way someone actually talks mid-game.",
    "- React to the SPECIFIC thing happening — the perk, the pallet, the read,",
    "  the misplay. Specificity is what makes commentary feel real.",
    "- NEVER describe what the viewer can already see. Add what they can't see:",
    "  what you were thinking, what you feared, why the play works or fails.",
    "- Banned energy: generic hype and YouTube-isms. No 'epic', 'insane',",
    "  'crazy', no 'welcome back guys', no 'let's dive in', no 'without further",
    "  ado', no 'stay tuned', no summarizing the video at the start or end.",
    "- Vary your openings. Never start two consecutive lines the same way.",
    "- Silence is a tool: a short punchy line beats a full paragraph. If a",
    "  moment speaks for itself, one dry remark is enough.",
    "",
    "Hard constraints:",
    `- FORBIDDEN words/phrases — never use: ${forbidden}`,
    `- Signature phrases (use at most twice across the whole script): ${catchphrases}`,
    `- Narration density: ${creative.narrationDensity}; pacing: ${creative.pacing}.`,
    "- RESPECT each beat's max word count strictly — the line must finish",
    "  before the next moment starts, or two lines will talk over each other.",
    "",
    "Story beats (write one section per beat, in this order):",
    ...beatLines,
    "",
    "For each section return: section_index (0-based), start_ms and end_ms (integer",
    "ms, within the footage, roughly aligned to the beat), an optional beat_label,",
    "and the narration text for that beat.",
    "",
    `Respond ONLY as JSON matching the provided schema (template ${SCRIPT_PROMPT_VERSION}).`,
  ].join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive search for any forbidden word/phrase in the text. Uses
 * word boundaries for single words; substring for multi-word phrases.
 * Returns the distinct forbidden terms that appear.
 */
export function findForbiddenViolations(
  text: string,
  forbiddenWords: string[],
): string[] {
  const hits: string[] = [];
  for (const raw of forbiddenWords) {
    const term = raw.trim();
    if (!term) continue;
    const pattern = /\s/.test(term)
      ? escapeRegExp(term)
      : `\\b${escapeRegExp(term)}\\b`;
    if (new RegExp(pattern, "i").test(text) && !hits.includes(term)) {
      hits.push(term);
    }
  }
  return hits;
}

/** Count how often each catchphrase appears (for a soft frequency budget). */
export function countCatchphrases(
  text: string,
  catchphrases: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const raw of catchphrases) {
    const term = raw.trim();
    if (!term) continue;
    const matches = text.match(new RegExp(escapeRegExp(term), "gi"));
    counts[term] = matches ? matches.length : 0;
  }
  return counts;
}
