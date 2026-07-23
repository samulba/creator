/**
 * Structured-output schemas + strict validators for story and script
 * generation (Phase 6). As with coarse analysis, the schema is sent to the
 * model but its output is never trusted: every field is re-checked, clamped,
 * and malformed entries are dropped or repaired (section indices are
 * re-sequenced so the unique constraint can never be violated).
 */

import type {
  ScriptResult,
  ScriptSectionDraft,
  StoryResult,
  StorySelection,
} from "./types.js";

export const STORY_PROMPT_VERSION = "story-v1";
export const SCRIPT_PROMPT_VERSION = "script-v1";

const TITLE_MAX = 300;
const ANGLE_MAX = 800;
const SUMMARY_MAX = 4000;
const ROLE_MAX = 40;
const STRUCTURE_TEXT_MAX = 2000;
const SECTION_TEXT_MAX = 8000;
const BEAT_LABEL_MAX = 120;
const MAX_SELECTIONS = 200;
const MAX_SECTIONS = 400;
const MAX_TURNING_POINTS = 20;

export const STORY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", nullable: true },
    angle: { type: "STRING", nullable: true },
    summary: { type: "STRING", nullable: true },
    structure: {
      type: "OBJECT",
      nullable: true,
      properties: {
        hook: { type: "STRING", nullable: true },
        setup: { type: "STRING", nullable: true },
        escalation: { type: "STRING", nullable: true },
        turning_points: { type: "ARRAY", items: { type: "STRING" } },
        climax: { type: "STRING", nullable: true },
        payoff: { type: "STRING", nullable: true },
      },
    },
    selections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          moment_index: { type: "INTEGER" },
          story_role: { type: "STRING" },
          sort_order: { type: "INTEGER", nullable: true },
        },
        required: ["moment_index", "story_role"],
      },
    },
  },
  required: ["title", "angle", "summary", "selections"],
} as const;

export const SCRIPT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          section_index: { type: "INTEGER" },
          start_ms: { type: "INTEGER" },
          end_ms: { type: "INTEGER" },
          beat_label: { type: "STRING", nullable: true },
          text: { type: "STRING" },
        },
        required: ["section_index", "start_ms", "end_ms", "text"],
      },
    },
  },
  required: ["sections"],
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function toInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function cleanStringList(value: unknown, max: number, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = cleanString(item, max);
    if (s && out.length < cap) out.push(s);
  }
  return out;
}

function normalizeStructure(raw: unknown): Record<string, unknown> {
  const record = asRecord(raw);
  if (!record) return {};
  const structure: Record<string, unknown> = {};
  for (const key of ["hook", "setup", "escalation", "climax", "payoff"]) {
    const value = cleanString(record[key], STRUCTURE_TEXT_MAX);
    if (value) structure[key] = value;
  }
  const turningPoints = cleanStringList(
    record.turning_points,
    STRUCTURE_TEXT_MAX,
    MAX_TURNING_POINTS,
  );
  if (turningPoints.length) structure.turning_points = turningPoints;
  return structure;
}

/**
 * Validate a story response. `momentCount` bounds selection indices so a
 * selection can never reference a moment that was not offered.
 */
export function normalizeStoryResult(
  raw: unknown,
  momentCount: number,
): StoryResult | null {
  const record = asRecord(raw);
  if (!record) return null;

  const selections: StorySelection[] = [];
  const seen = new Set<string>();
  if (Array.isArray(record.selections)) {
    for (const item of record.selections.slice(0, MAX_SELECTIONS)) {
      const sel = asRecord(item);
      if (!sel) continue;
      const momentIndex = toInt(sel.moment_index);
      const storyRole = cleanString(sel.story_role, ROLE_MAX);
      if (
        momentIndex === null ||
        momentIndex < 0 ||
        momentIndex >= momentCount ||
        !storyRole
      ) {
        continue;
      }
      const key = `${momentIndex}:${storyRole}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sortOrder = toInt(sel.sort_order);
      selections.push({
        momentIndex,
        storyRole,
        // Missing sort_order sinks below explicit values; ties are broken by
        // arrival order in the stable sort below.
        sortOrder:
          sortOrder !== null && sortOrder >= 0
            ? sortOrder
            : Number.MAX_SAFE_INTEGER,
      });
    }
  }
  // RE-SEQUENCE to 0..n-1 (like script sections): raw model values may
  // collide or leave gaps, and duplicate sort_order values would make the
  // beat order nondeterministic on later reads.
  selections.sort((a, b) => a.sortOrder - b.sortOrder);
  selections.forEach((selection, index) => {
    selection.sortOrder = index;
  });

  return {
    title: cleanString(record.title, TITLE_MAX),
    angle: cleanString(record.angle, ANGLE_MAX),
    summary: cleanString(record.summary, SUMMARY_MAX),
    structure: normalizeStructure(record.structure),
    selections,
  };
}

type ScriptNormalizeOptions = { durationMs?: number | null };

/**
 * Validate a script response. Section indices are RE-SEQUENCED to 0..n-1 in
 * (given index, then start time) order, so the DB's unique
 * (script_version_id, section_index) can never be violated by model output.
 */
export function normalizeScriptResult(
  raw: unknown,
  options: ScriptNormalizeOptions = {},
): ScriptResult | null {
  const record = asRecord(raw);
  if (!record) return null;
  const durationMs = options.durationMs ?? null;

  const rawSections = Array.isArray(record.sections)
    ? record.sections.slice(0, MAX_SECTIONS)
    : [];

  const drafts: Array<{ order: number; start: number; section: ScriptSectionDraft }> =
    [];
  for (const item of rawSections) {
    const sec = asRecord(item);
    if (!sec) continue;
    const text = cleanString(sec.text, SECTION_TEXT_MAX);
    if (!text) continue;

    let start = toInt(sec.start_ms);
    let end = toInt(sec.end_ms);
    if (start === null || start < 0) start = 0;
    if (end === null) end = start + 1;
    if (durationMs !== null && durationMs > 0) {
      if (end > durationMs) end = durationMs;
      if (start >= durationMs) start = Math.max(0, durationMs - 1);
    }
    if (end <= start) end = start + 1;

    const givenIndex = toInt(sec.section_index);
    drafts.push({
      order: givenIndex !== null ? givenIndex : drafts.length,
      start,
      section: {
        sectionIndex: 0, // reassigned below
        startMs: start,
        endMs: end,
        beatLabel: cleanString(sec.beat_label, BEAT_LABEL_MAX),
        text,
      },
    });
  }

  drafts.sort((a, b) => a.order - b.order || a.start - b.start);
  const sections = drafts.map((d, i) => ({ ...d.section, sectionIndex: i }));
  const fullText = sections.map((s) => s.text).join("\n\n");

  return { sections, fullText };
}
