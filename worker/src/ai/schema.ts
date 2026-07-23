/**
 * Structured-output schema for coarse gameplay analysis, plus a strict
 * runtime validator. The schema is sent to Gemini so it returns JSON in a
 * known shape; the validator never trusts that — it re-checks every field,
 * clamps ranges to the database constraints (migration 007), and drops
 * anything malformed. Provider output is data, not instructions.
 */

import type {
  AnalysisEvent,
  AnalysisMoment,
  CoarseAnalysisResult,
} from "./types.js";

/** Bumped when the prompt or output contract changes; recorded per run. */
export const PROMPT_TEMPLATE_VERSION = "coarse-v1";

/** Hard caps so a pathological response can't blow up the DB write. */
const MAX_EVENTS = 500;
const MAX_MOMENTS = 200;
const MAX_SUPPORTING = 32;
const SUMMARY_MAX = 4000; // matches analysis_runs_summary_length
const TITLE_MAX = 500;
const TEXT_MAX = 2000;
const EVENT_TYPE_MAX = 80; // matches gameplay_events_event_type_length

/**
 * Gemini `responseSchema` (OpenAPI 3.0 subset — types are UPPERCASE per the
 * Gemini Schema enum). Free-form maps (actor labels) are intentionally left
 * out of the strict schema and filled later by deep analysis.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      nullable: true,
      description: "2–4 sentence factual recap of the match, no embellishment.",
    },
    match_context: {
      type: "OBJECT",
      nullable: true,
      properties: {
        role: {
          type: "STRING",
          nullable: true,
          enum: ["killer", "survivor", "unknown"],
        },
        killer_character: { type: "STRING", nullable: true },
        map: { type: "STRING", nullable: true },
        outcome: { type: "STRING", nullable: true },
      },
    },
    events: {
      type: "ARRAY",
      description: "Factual gameplay events, in chronological order.",
      items: {
        type: "OBJECT",
        properties: {
          event_type: { type: "STRING" },
          start_ms: { type: "INTEGER" },
          end_ms: { type: "INTEGER" },
          confidence: { type: "NUMBER", nullable: true },
          importance: { type: "NUMBER", nullable: true },
          title: { type: "STRING", nullable: true },
          summary: { type: "STRING", nullable: true },
        },
        required: ["event_type", "start_ms", "end_ms"],
      },
    },
    moments: {
      type: "ARRAY",
      description: "Segments worth keeping in the edit, citing events.",
      items: {
        type: "OBJECT",
        properties: {
          moment_type: { type: "STRING" },
          start_ms: { type: "INTEGER" },
          end_ms: { type: "INTEGER" },
          confidence: { type: "NUMBER", nullable: true },
          importance: { type: "NUMBER", nullable: true },
          title: { type: "STRING", nullable: true },
          summary: { type: "STRING", nullable: true },
          selection_reason: { type: "STRING", nullable: true },
          supporting_event_indices: {
            type: "ARRAY",
            items: { type: "INTEGER" },
          },
        },
        required: ["moment_type", "start_ms", "end_ms"],
      },
    },
  },
  required: ["summary", "events", "moments"],
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

/** Coerce to an integer millisecond value, or null if not usable. */
function toMs(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function clamp(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

type NormalizeOptions = {
  /** Proxy duration in ms; timestamps are clamped to it when provided. */
  durationMs?: number | null;
};

function normalizeRange(
  rawStart: unknown,
  rawEnd: unknown,
  durationMs: number | null,
): { startMs: number; endMs: number } | null {
  const start = toMs(rawStart);
  let end = toMs(rawEnd);
  if (start === null || end === null) return null;

  // Give a small slack over the known duration for rounding, then clamp.
  if (durationMs !== null && durationMs > 0) {
    const ceiling = durationMs + 500;
    if (start >= ceiling) return null; // starts past the footage → bogus
    if (end > durationMs) end = durationMs;
  }
  if (end <= start) return null;
  return { startMs: start, endMs: end };
}

function normalizeEvent(
  raw: unknown,
  durationMs: number | null,
): AnalysisEvent | null {
  const record = asRecord(raw);
  if (!record) return null;

  const eventType = cleanString(record.event_type, EVENT_TYPE_MAX);
  if (!eventType) return null;

  const range = normalizeRange(record.start_ms, record.end_ms, durationMs);
  if (!range) return null;

  return {
    eventType,
    startMs: range.startMs,
    endMs: range.endMs,
    confidence: clamp(record.confidence, 0, 1),
    importance: clamp(record.importance, 0, 100),
    title: cleanString(record.title, TITLE_MAX),
    summary: cleanString(record.summary, TEXT_MAX),
    actorLabels: {},
  };
}

function normalizeMoment(
  raw: unknown,
  durationMs: number | null,
  eventCount: number,
): AnalysisMoment | null {
  const record = asRecord(raw);
  if (!record) return null;

  const momentType = cleanString(record.moment_type, EVENT_TYPE_MAX);
  if (!momentType) return null;

  const range = normalizeRange(record.start_ms, record.end_ms, durationMs);
  if (!range) return null;

  const indices: number[] = [];
  if (Array.isArray(record.supporting_event_indices)) {
    for (const value of record.supporting_event_indices) {
      const idx = typeof value === "number" ? value : Number(value);
      if (
        Number.isInteger(idx) &&
        idx >= 0 &&
        idx < eventCount &&
        !indices.includes(idx) &&
        indices.length < MAX_SUPPORTING
      ) {
        indices.push(idx);
      }
    }
  }

  return {
    momentType,
    startMs: range.startMs,
    endMs: range.endMs,
    confidence: clamp(record.confidence, 0, 1),
    importance: clamp(record.importance, 0, 100),
    title: cleanString(record.title, TITLE_MAX),
    summary: cleanString(record.summary, TEXT_MAX),
    selectionReason: cleanString(record.selection_reason, TEXT_MAX),
    supportingEventIndices: indices,
  };
}

/**
 * Validate and clamp a raw provider response into a CoarseAnalysisResult.
 * Malformed events/moments are dropped individually; only a fundamentally
 * unusable payload (not an object) returns null so the caller can fail the
 * job cleanly. Moment→event indices are validated against the surviving
 * event list, so links can never dangle.
 */
export function normalizeCoarseResult(
  raw: unknown,
  options: NormalizeOptions = {},
): CoarseAnalysisResult | null {
  const record = asRecord(raw);
  if (!record) return null;

  const durationMs = options.durationMs ?? null;

  const rawEvents = Array.isArray(record.events)
    ? record.events.slice(0, MAX_EVENTS)
    : [];
  const events: AnalysisEvent[] = [];
  for (const item of rawEvents) {
    const event = normalizeEvent(item, durationMs);
    if (event) events.push(event);
  }
  events.sort((a, b) => a.startMs - b.startMs);

  const rawMoments = Array.isArray(record.moments)
    ? record.moments.slice(0, MAX_MOMENTS)
    : [];
  const moments: AnalysisMoment[] = [];
  for (const item of rawMoments) {
    const moment = normalizeMoment(item, durationMs, events.length);
    if (moment) moments.push(moment);
  }
  moments.sort((a, b) => a.startMs - b.startMs);

  const matchContext = asRecord(record.match_context) ?? {};

  return {
    summary: cleanString(record.summary, SUMMARY_MAX),
    matchContext,
    events,
    moments,
  };
}
