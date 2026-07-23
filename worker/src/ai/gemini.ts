/**
 * Gemini analysis provider.
 *
 * Implemented directly against the documented Generative Language REST API
 * (File API for the video upload + generateContent with a responseSchema) so
 * there is no opaque SDK in the pipeline and the exact wire contract is
 * visible here. Uses the global fetch in Node 22 — no extra dependency.
 *
 * IMPORTANT: the live HTTP calls in this file cannot be exercised without a
 * real GEMINI_API_KEY, so they are NOT covered by the worker's automated
 * tests. The schema validation, prompt assembly, and result mapping that
 * surround them ARE tested (see ai/schema.test.ts). Treat the request/response
 * shapes here as verified against Google's documentation, not against a live
 * round-trip. The first real run against a funded key is the true integration
 * test.
 */

import {
  buildCoarsePrompt,
  buildScriptPrompt,
  buildStoryPrompt,
} from "./context.js";
import { GEMINI_RESPONSE_SCHEMA, normalizeCoarseResult } from "./schema.js";
import {
  normalizeScriptResult,
  normalizeStoryResult,
  SCRIPT_RESPONSE_SCHEMA,
  STORY_RESPONSE_SCHEMA,
} from "./story-schema.js";
import {
  ProviderError,
  type CoarseAnalysisInput,
  type CoarseAnalysisResult,
  type GenerativeProvider,
  type ProviderProgress,
  type ScriptGenerationInput,
  type ScriptResult,
  type StoryGenerationInput,
  type StoryResult,
} from "./types.js";

const API_BASE = "https://generativelanguage.googleapis.com";

/** Bytes we are willing to buffer in memory for the File API upload. */
const MAX_PROXY_BYTES = 1_500_000_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GeminiFile = {
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: string;
  error?: { message?: string };
};

type GenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

export type GeminiConfig = {
  apiKey: string;
  model: string;
  fileActiveTimeoutMs: number;
  requestTimeoutMs: number;
};

export function createGeminiProvider(config: GeminiConfig): GenerativeProvider {
  const key = config.apiKey;

  async function fetchProxyBytes(input: CoarseAnalysisInput): Promise<Buffer> {
    const response = await fetch(input.proxyUrl, {
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    if (!response.ok) {
      throw new ProviderError(
        "PROXY_FETCH_FAILED",
        "Could not read the analysis proxy from storage.",
        { retryable: true, details: { status: response.status } },
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new ProviderError("PROXY_EMPTY", "The analysis proxy was empty.", {
        retryable: true,
      });
    }
    if (bytes.byteLength > MAX_PROXY_BYTES) {
      throw new ProviderError(
        "PROXY_TOO_LARGE",
        "The analysis proxy is too large to upload for analysis.",
        { retryable: false, details: { bytes: bytes.byteLength } },
      );
    }
    return bytes;
  }

  /** Resumable upload of the proxy to the File API; returns the File resource. */
  async function uploadFile(
    bytes: Buffer,
    mimeType: string,
    displayName: string,
  ): Promise<GeminiFile> {
    const start = await fetch(`${API_BASE}/upload/v1beta/files?key=${key}`, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    if (!start.ok) {
      throw await providerErrorFromResponse(
        "FILE_UPLOAD_START_FAILED",
        "file upload start",
        start,
      );
    }
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      throw new ProviderError(
        "FILE_UPLOAD_NO_URL",
        "Gemini did not return an upload URL.",
        { retryable: true },
      );
    }

    const finalize = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: bytes,
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    if (!finalize.ok) {
      throw await providerErrorFromResponse(
        "FILE_UPLOAD_FAILED",
        "file upload",
        finalize,
      );
    }
    const payload = (await finalize.json()) as { file?: GeminiFile };
    const file = payload.file;
    if (!file?.name) {
      throw new ProviderError(
        "FILE_UPLOAD_NO_NAME",
        "Gemini upload did not return a file handle.",
        { retryable: true },
      );
    }
    return file;
  }

  /** Poll GET files/{name} until the video is ACTIVE (or fails/times out). */
  async function waitForActive(
    file: GeminiFile,
    onProgress?: ProviderProgress,
  ): Promise<GeminiFile> {
    const deadline = Date.now() + config.fileActiveTimeoutMs;
    let current = file;
    while (current.state !== "ACTIVE") {
      if (current.state === "FAILED") {
        throw new ProviderError(
          "FILE_PROCESSING_FAILED",
          "Gemini could not process the uploaded footage.",
          { retryable: true, details: { reason: current.error?.message } },
        );
      }
      if (Date.now() > deadline) {
        throw new ProviderError(
          "FILE_ACTIVE_TIMEOUT",
          "Gemini did not finish preparing the footage in time.",
          { retryable: true },
        );
      }
      onProgress?.("waiting for footage to be processed");
      await sleep(3000);
      const check = await fetch(
        `${API_BASE}/v1beta/${current.name}?key=${key}`,
        { signal: AbortSignal.timeout(config.requestTimeoutMs) },
      );
      if (!check.ok) {
        throw await providerErrorFromResponse(
          "FILE_STATUS_FAILED",
          "file status check",
          check,
        );
      }
      current = (await check.json()) as GeminiFile;
    }
    if (!current.uri) {
      throw new ProviderError(
        "FILE_NO_URI",
        "Gemini file became active without a URI.",
        { retryable: true },
      );
    }
    return current;
  }

  async function deleteFile(file: GeminiFile): Promise<void> {
    if (!file.name) return;
    try {
      await fetch(`${API_BASE}/v1beta/${file.name}?key=${key}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      // Best effort — files auto-expire after 48h regardless.
    }
  }

  /** Low-level generateContent call returning parsed JSON. */
  async function callGenerate(
    parts: Array<Record<string, unknown>>,
    schema: unknown,
  ): Promise<unknown> {
    const response = await fetch(
      `${API_BASE}/v1beta/models/${config.model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.3,
          },
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      },
    );
    if (!response.ok) {
      throw await providerErrorFromResponse(
        "GENERATE_FAILED",
        "generateContent",
        response,
      );
    }

    const payload = (await response.json()) as GenerateContentResponse;
    if (payload.promptFeedback?.blockReason) {
      throw new ProviderError(
        "GENERATE_BLOCKED",
        "The request was blocked by the model's safety filter.",
        { retryable: false, details: { reason: payload.promptFeedback.blockReason } },
      );
    }
    const candidate = payload.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      throw new ProviderError("GENERATE_EMPTY", "The model returned nothing.", {
        retryable: true,
        details: { finishReason: candidate?.finishReason },
      });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError(
        "GENERATE_UNPARSEABLE",
        "The model returned malformed JSON.",
        { retryable: true, details: { finishReason: candidate?.finishReason } },
      );
    }
  }

  return {
    id: "gemini",
    model: config.model,

    async analyzeCoarse(
      input: CoarseAnalysisInput,
      onProgress?: ProviderProgress,
    ): Promise<CoarseAnalysisResult> {
      const prompt = buildCoarsePrompt(input);

      onProgress?.("uploading footage to Gemini");
      const bytes = await fetchProxyBytes(input);
      const uploaded = await uploadFile(
        bytes,
        input.proxyMimeType,
        input.proxyObjectKey,
      );

      let file: GeminiFile | null = null;
      try {
        file = await waitForActive(uploaded, onProgress);
        onProgress?.("analyzing gameplay");
        const raw = await callGenerate(
          [
            { file_data: { mime_type: input.proxyMimeType, file_uri: file.uri } },
            { text: prompt },
          ],
          GEMINI_RESPONSE_SCHEMA,
        );

        const result = normalizeCoarseResult(raw, {
          durationMs: input.durationMs,
        });
        if (!result) {
          throw new ProviderError(
            "RESULT_INVALID",
            "The analysis response did not match the expected shape.",
            { retryable: true },
          );
        }
        return result;
      } finally {
        if (file ?? uploaded) await deleteFile(file ?? uploaded);
      }
    },

    async generateStory(
      input: StoryGenerationInput,
      onProgress?: ProviderProgress,
    ): Promise<StoryResult> {
      onProgress?.("choosing the narrative angle");
      const raw = await callGenerate(
        [{ text: buildStoryPrompt(input) }],
        STORY_RESPONSE_SCHEMA,
      );
      const result = normalizeStoryResult(raw, input.moments.length);
      if (!result) {
        throw new ProviderError(
          "STORY_INVALID",
          "The story response did not match the expected shape.",
          { retryable: true },
        );
      }
      return result;
    },

    async generateScript(
      input: ScriptGenerationInput,
      onProgress?: ProviderProgress,
    ): Promise<ScriptResult> {
      onProgress?.("writing the narration script");
      const raw = await callGenerate(
        [{ text: buildScriptPrompt(input) }],
        SCRIPT_RESPONSE_SCHEMA,
      );
      const result = normalizeScriptResult(raw, {
        durationMs: input.durationMs,
      });
      if (!result) {
        throw new ProviderError(
          "SCRIPT_INVALID",
          "The script response did not match the expected shape.",
          { retryable: true },
        );
      }
      return result;
    },
  } satisfies GenerativeProvider;
}

async function providerErrorFromResponse(
  code: string,
  step: string,
  response: Response,
): Promise<ProviderError> {
  const status = response.status;
  // 429/5xx are transient; 4xx (bad key, quota exhausted config) are not.
  const retryable = status === 429 || status >= 500;

  // Google returns a JSON error envelope; surface its message so a failure
  // is diagnosable from the stored failure_message alone.
  let detail: string | null = null;
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    detail = body.error?.message?.slice(0, 300) ?? null;
  } catch {
    // Non-JSON error body — keep the status-only message.
  }

  const hint =
    status === 404 && step === "generateContent"
      ? " The configured Gemini model is likely retired or misspelled — set GEMINI_MODEL to a current model."
      : "";

  return new ProviderError(
    code,
    `Gemini ${step} failed (${status})${detail ? `: ${detail}` : ""}.${hint}`,
    { retryable, details: { status, step, detail } },
  );
}
