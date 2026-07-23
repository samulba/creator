/**
 * Voice configuration resolution (Phase 7). Pure, testable helpers that turn a
 * script's frozen narrator_config into a concrete ElevenLabs request config.
 *
 * Consistency rule: the model id is PINNED — taken from the character's
 * voice_settings.model_id, or a configured default id. It is never a provider
 * "latest" alias, so re-runs and future videos use the same model.
 */

import type { ResolvedVoiceConfig, VoiceSettings } from "./types.js";

export const VOICE_PROMPT_VERSION = "voice-v1";

function clampUnit(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

function clampSpeed(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  // ElevenLabs supports roughly 0.7–1.2; clamp to keep requests valid.
  return Math.min(1.2, Math.max(0.7, n));
}

/** Extract only the supported, in-range voice settings. */
export function resolveVoiceSettings(raw: unknown): VoiceSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const settings: VoiceSettings = {};

  const stability = clampUnit(source.stability);
  if (stability !== undefined) settings.stability = stability;

  const similarity = clampUnit(source.similarity_boost);
  if (similarity !== undefined) settings.similarity_boost = similarity;

  const style = clampUnit(source.style);
  if (style !== undefined) settings.style = style;

  if (typeof source.use_speaker_boost === "boolean") {
    settings.use_speaker_boost = source.use_speaker_boost;
  }

  const speed = clampSpeed(source.speed);
  if (speed !== undefined) settings.speed = speed;

  return settings;
}

/**
 * Resolve a frozen narrator_config into a concrete voice request config.
 * Returns null when no voice is configured (a first-class, non-retryable
 * failure the handler reports clearly rather than silently skipping).
 */
export function resolveVoiceConfig(
  narratorConfig: Record<string, unknown>,
  defaults: { model: string; outputFormat: string },
): ResolvedVoiceConfig | null {
  const voiceKey =
    typeof narratorConfig.voice_key === "string"
      ? narratorConfig.voice_key.trim()
      : "";
  if (!voiceKey) return null;

  const voiceSettings = (narratorConfig.voice_settings ?? {}) as Record<
    string,
    unknown
  >;
  const pinnedModel =
    typeof voiceSettings.model_id === "string" &&
    voiceSettings.model_id.trim() &&
    voiceSettings.model_id.trim() !== "latest"
      ? voiceSettings.model_id.trim()
      : defaults.model;

  const provider =
    typeof narratorConfig.voice_provider === "string" &&
    narratorConfig.voice_provider.trim()
      ? narratorConfig.voice_provider.trim()
      : "elevenlabs";

  return {
    provider,
    voiceKey,
    modelId: pinnedModel,
    settings: resolveVoiceSettings(voiceSettings),
    outputFormat: defaults.outputFormat,
  };
}

/** The JSON body ElevenLabs expects for a text-to-speech request. */
export function buildElevenLabsBody(input: {
  text: string;
  modelId: string;
  settings: VoiceSettings;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    text: input.text,
    model_id: input.modelId,
  };
  if (Object.keys(input.settings).length > 0) {
    body.voice_settings = input.settings;
  }
  return body;
}

/** File extension + content type for an ElevenLabs output_format string. */
export function outputFormatToFile(outputFormat: string): {
  extension: string;
  contentType: string;
} {
  if (outputFormat.startsWith("pcm")) {
    return { extension: "pcm", contentType: "audio/basic" };
  }
  if (outputFormat.startsWith("ulaw")) {
    return { extension: "ulaw", contentType: "audio/basic" };
  }
  if (outputFormat.startsWith("opus")) {
    return { extension: "opus", contentType: "audio/opus" };
  }
  // mp3_* and anything else defaults to mp3.
  return { extension: "mp3", contentType: "audio/mpeg" };
}
