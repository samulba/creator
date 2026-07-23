/**
 * Analysis provider factory. Returns null when no provider is configured, so
 * the worker can leave `coarse_analysis` jobs queued instead of failing them
 * (graceful degradation — the pipeline pauses rather than breaking).
 */

import { env } from "../env.js";

import { createGeminiProvider } from "./gemini.js";
import type { AnalysisProvider } from "./types.js";

let cached: AnalysisProvider | null | undefined;

export function getAnalysisProvider(): AnalysisProvider | null {
  if (cached !== undefined) return cached;

  if (env.gemini.apiKey) {
    cached = createGeminiProvider({
      apiKey: env.gemini.apiKey,
      model: env.gemini.model,
      fileActiveTimeoutMs: env.gemini.fileActiveTimeoutMs,
      requestTimeoutMs: env.gemini.requestTimeoutMs,
    });
  } else {
    cached = null;
  }
  return cached;
}

export type {
  AnalysisProvider,
  CoarseAnalysisInput,
  CoarseAnalysisResult,
} from "./types.js";
