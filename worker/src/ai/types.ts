/**
 * Provider-agnostic contract for gameplay analysis. The worker depends only
 * on this interface; concrete providers (Gemini today) live behind it so a
 * different model or vendor can be swapped in without touching the job
 * handler. Keeping the boundary here also means the schema validation and DB
 * mapping are shared across providers.
 */

/** Normalized narrator persona, distilled from a Character's speech_style. */
export type PersonaContext = {
  characterId: string | null;
  name: string | null;
  language: string;
  /** Free-form but structured; only used to steer selection + framing. */
  tone: string | null;
  humorLevel: string | null;
  energy: string | null;
  catchphrases: string[];
  forbiddenWords: string[];
  /**
   * Stable hash of the resolved character configuration. Recorded on the
   * analysis run so a video's provenance ties back to an exact persona
   * version — part of the per-channel consistency model.
   */
  configHash: string | null;
};

/** The channel/project creative dials that bias what matters in a match. */
export type CreativeContext = {
  creativeDirection: string;
  pacing: string;
  narrationDensity: string;
  gameplayPreservation: string;
  targetLength: string;
};

/** Everything a provider needs to analyze one gameplay proxy. */
export type CoarseAnalysisInput = {
  projectTitle: string;
  /** Presigned R2 URL of the downscaled proxy video. */
  proxyUrl: string;
  proxyObjectKey: string;
  proxyMimeType: string;
  /** Proxy duration in ms, when known — used to bound reported timestamps. */
  durationMs: number | null;
  persona: PersonaContext;
  creative: CreativeContext;
};

/** A factual gameplay event the model detected, grounded in the footage. */
export type AnalysisEvent = {
  eventType: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
  importance: number | null;
  title: string | null;
  summary: string | null;
  actorLabels: Record<string, unknown>;
};

/** A moment proposed as a story candidate, optionally citing events. */
export type AnalysisMoment = {
  momentType: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
  importance: number | null;
  title: string | null;
  summary: string | null;
  selectionReason: string | null;
  /** Indices into the same result's `events` array (already validated). */
  supportingEventIndices: number[];
};

/** Validated result of a coarse analysis pass. */
export type CoarseAnalysisResult = {
  summary: string | null;
  matchContext: Record<string, unknown>;
  events: AnalysisEvent[];
  moments: AnalysisMoment[];
};

/** Progress callback so long provider calls can keep the job lease alive. */
export type ProviderProgress = (note: string) => void;

/** A concrete analysis backend (e.g. Gemini). */
export type AnalysisProvider = {
  readonly id: string;
  readonly model: string;
  analyzeCoarse(
    input: CoarseAnalysisInput,
    onProgress?: ProviderProgress,
  ): Promise<CoarseAnalysisResult>;
};

/** Thrown by providers for a controlled, classified failure. */
export class ProviderError extends Error {
  code: string;
  retryable: boolean;
  details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = options?.retryable ?? true;
    this.details = options?.details ?? {};
  }
}
