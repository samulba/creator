/**
 * ElevenLabs text-to-speech provider.
 *
 * Implemented directly against the documented REST API using the global fetch
 * in Node 22 (no SDK dependency), so the wire contract is visible here.
 *
 * IMPORTANT: like the Gemini provider, the live HTTP call cannot be exercised
 * without a real, funded ELEVENLABS_API_KEY — it is NOT covered by automated
 * tests. The request-body building and voice-config resolution around it ARE
 * tested (see ai/voice.test.ts). A missing/deleted provider voice (404) is a
 * first-class, non-retryable failure so it surfaces clearly instead of
 * retrying forever.
 */

import { buildElevenLabsBody, outputFormatToFile } from "./voice.js";
import {
  ProviderError,
  type ProviderProgress,
  type VoiceProvider,
  type VoiceSynthesisInput,
  type VoiceSynthesisResult,
} from "./types.js";

const API_BASE = "https://api.elevenlabs.io";

export type ElevenLabsConfig = {
  apiKey: string;
  requestTimeoutMs: number;
};

export function createElevenLabsProvider(
  config: ElevenLabsConfig,
): VoiceProvider {
  return {
    id: "elevenlabs",

    async synthesize(
      input: VoiceSynthesisInput,
      onProgress?: ProviderProgress,
    ): Promise<VoiceSynthesisResult> {
      onProgress?.("synthesizing narration");

      const url =
        `${API_BASE}/v1/text-to-speech/${encodeURIComponent(input.voiceKey)}` +
        `?output_format=${encodeURIComponent(input.outputFormat)}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": config.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify(
          buildElevenLabsBody({
            text: input.text,
            modelId: input.modelId,
            settings: input.settings,
          }),
        ),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!response.ok) {
        throw errorForStatus(response.status);
      }

      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.byteLength === 0) {
        throw new ProviderError(
          "VOICE_EMPTY_AUDIO",
          "The voice provider returned empty audio.",
          { retryable: true },
        );
      }

      const { contentType } = outputFormatToFile(input.outputFormat);
      return {
        audio,
        contentType,
        requestId:
          response.headers.get("request-id") ??
          response.headers.get("x-request-id"),
      };
    },
  };
}

function errorForStatus(status: number): ProviderError {
  if (status === 404) {
    return new ProviderError(
      "VOICE_MISSING",
      "The narrator voice no longer exists at the provider.",
      { retryable: false, details: { status } },
    );
  }
  if (status === 401 || status === 403) {
    return new ProviderError(
      "VOICE_AUTH_FAILED",
      "The voice provider rejected the API key.",
      { retryable: false, details: { status } },
    );
  }
  if (status === 422) {
    return new ProviderError(
      "VOICE_BAD_REQUEST",
      "The voice request was rejected as invalid.",
      { retryable: false, details: { status } },
    );
  }
  // 429 + 5xx are transient.
  const retryable = status === 429 || status >= 500;
  return new ProviderError(
    "VOICE_REQUEST_FAILED",
    `The voice provider request failed (${status}).`,
    { retryable, details: { status } },
  );
}
