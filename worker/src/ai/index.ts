/**
 * Generative provider factory (analysis + story + script). Returns null when
 * no provider is configured, so the worker can leave the AI jobs queued
 * instead of failing them (graceful degradation — the pipeline pauses rather
 * than breaking).
 */

import { env } from "../env.js";

import { createElevenLabsProvider } from "./elevenlabs.js";
import { createGeminiProvider } from "./gemini.js";
import type { GenerativeProvider, VoiceProvider } from "./types.js";

let cachedGenerative: GenerativeProvider | null | undefined;
let cachedVoice: VoiceProvider | null | undefined;

export function getGenerativeProvider(): GenerativeProvider | null {
  if (cachedGenerative !== undefined) return cachedGenerative;

  if (env.gemini.apiKey) {
    cachedGenerative = createGeminiProvider({
      apiKey: env.gemini.apiKey,
      model: env.gemini.model,
      fileActiveTimeoutMs: env.gemini.fileActiveTimeoutMs,
      requestTimeoutMs: env.gemini.requestTimeoutMs,
    });
  } else {
    cachedGenerative = null;
  }
  return cachedGenerative;
}

export function getVoiceProvider(): VoiceProvider | null {
  if (cachedVoice !== undefined) return cachedVoice;

  if (env.elevenlabs.apiKey) {
    cachedVoice = createElevenLabsProvider({
      apiKey: env.elevenlabs.apiKey,
      requestTimeoutMs: env.elevenlabs.requestTimeoutMs,
    });
  } else {
    cachedVoice = null;
  }
  return cachedVoice;
}

export type {
  GenerativeProvider,
  VoiceProvider,
  CoarseAnalysisInput,
  CoarseAnalysisResult,
} from "./types.js";
