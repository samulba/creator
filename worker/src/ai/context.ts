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
import type {
  CoarseAnalysisInput,
  CreativeContext,
  PersonaContext,
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
    catchphrases: strList(style.catchphrases),
    forbiddenWords: strList(style.forbidden_words),
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
