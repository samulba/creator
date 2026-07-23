import { randomUUID } from "node:crypto";

import { getVoiceProvider } from "../ai/index.js";
import { ProviderError } from "../ai/types.js";
import { resolveVoiceConfig, outputFormatToFile, VOICE_PROMPT_VERSION } from "../ai/voice.js";
import { env } from "../env.js";
import { uploadBuffer } from "../r2.js";
import {
  enqueuePipelineJob,
  insertAsset,
  insertNarrationAsset,
  loadLatestScriptVersion,
  loadNarratedSectionIds,
  loadOriginalSource,
  loadScriptSections,
  loadScriptVersion,
  setProjectState,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/** Derives the project asset prefix from an object key (before /assets/). */
function assetPrefix(objectKey: string): string {
  const marker = "/assets/";
  const index = objectKey.indexOf(marker);
  return index === -1 ? objectKey : objectKey.slice(0, index);
}

/**
 * Voice engine (Phase 7). Synthesizes each script section with ElevenLabs
 * using the frozen narrator_config (pinned model), stores each clip in R2 as
 * a narration_audio asset, and records a narration_assets row with the frozen
 * voice_config + provider request id. Pipeline stage: generating_voice →
 * building_edit.
 *
 * A narrator with no configured voice is a first-class, non-retryable failure
 * (VOICE_NOT_CONFIGURED) rather than a silent skip.
 */
export const voiceGeneration: JobHandler = async (job, ctx) => {
  const provider = getVoiceProvider();
  if (!provider) {
    throw new JobError(
      "VOICE_PROVIDER_NOT_CONFIGURED",
      "No voice provider is configured on this worker.",
      { retryable: true, failProject: false },
    );
  }

  await ctx.heartbeat({
    stage: "generating_voice",
    activity: "Recording the narration",
  });
  await setProjectState(job.project_id, "generating_voice");

  const payload = job.payload as { script_version_id?: string };
  const script = payload.script_version_id
    ? await loadScriptVersion(payload.script_version_id)
    : await loadLatestScriptVersion(job.project_id);
  if (!script) {
    throw new JobError(
      "VOICE_NO_SCRIPT",
      "No script was found to narrate.",
      { retryable: false },
    );
  }

  const voiceConfig = resolveVoiceConfig(script.narrator_config, {
    model: env.elevenlabs.defaultModel,
    outputFormat: env.elevenlabs.outputFormat,
  });
  if (!voiceConfig) {
    throw new JobError(
      "VOICE_NOT_CONFIGURED",
      "This project's narrator has no voice configured. Add a voice to the character.",
      { retryable: false },
    );
  }

  const sections = await loadScriptSections(script.id);
  if (sections.length === 0) {
    throw new JobError("VOICE_NO_SECTIONS", "The script has no sections.", {
      retryable: false,
    });
  }

  const source = await loadOriginalSource(job.project_id);
  if (!source) {
    throw new JobError(
      "SOURCE_MISSING",
      "The original source could not be located for asset storage.",
      { retryable: false },
    );
  }
  const prefix = assetPrefix(source.object_key);
  const { extension } = outputFormatToFile(voiceConfig.outputFormat);

  // Skip sections already narrated (idempotent re-runs).
  const alreadyDone = await loadNarratedSectionIds(sections.map((s) => s.id));
  const characterConfigHash =
    (script.generation_metadata?.character_config_hash as string | undefined) ??
    null;

  let narratedCount = alreadyDone.size;
  for (const section of sections) {
    if (alreadyDone.has(section.id)) continue;

    await ctx.heartbeat({
      stage: "generating_voice",
      activity: `Recording narration ${section.section_index + 1}/${sections.length}`,
    });

    let synthesis;
    try {
      synthesis = await provider.synthesize({
        voiceKey: voiceConfig.voiceKey,
        modelId: voiceConfig.modelId,
        settings: voiceConfig.settings,
        outputFormat: voiceConfig.outputFormat,
        text: section.text,
      });
    } catch (error) {
      if (error instanceof ProviderError) {
        throw new JobError(error.code, error.message, {
          retryable: error.retryable,
          details: error.details,
        });
      }
      throw error;
    }

    const audioAssetId = randomUUID();
    const objectKey = `${prefix}/assets/${audioAssetId}/narration.${extension}`;
    await uploadBuffer(objectKey, synthesis.audio, synthesis.contentType);

    await insertAsset({
      id: audioAssetId,
      project_id: job.project_id,
      asset_type: "narration_audio",
      status: "available",
      bucket: source.bucket,
      object_key: objectKey,
      content_type: synthesis.contentType,
      byte_size: synthesis.audio.byteLength,
      available_at: new Date().toISOString(),
      created_by_job_id: job.id,
      metadata: {
        script_version_id: script.id,
        script_section_id: section.id,
      },
    });

    await insertNarrationAsset({
      project_id: job.project_id,
      script_section_id: section.id,
      asset_id: audioAssetId,
      status: "available",
      voice_provider: voiceConfig.provider,
      voice_config: {
        voice_key: voiceConfig.voiceKey,
        model_id: voiceConfig.modelId,
        settings: voiceConfig.settings,
        output_format: voiceConfig.outputFormat,
      },
      generation_metadata: {
        provider: provider.id,
        model_id: voiceConfig.modelId,
        prompt_template_version: VOICE_PROMPT_VERSION,
        character_config_hash: characterConfigHash,
        request_id: synthesis.requestId,
      },
      created_by_job_id: job.id,
    });

    narratedCount += 1;
  }

  // Narration done; hand off to the edit engine (Phase 8 — stays queued).
  await setProjectState(job.project_id, "building_edit");
  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "edit_planning",
    idempotencyKey: `edit-planning:${script.id}`,
    payload: { script_version_id: script.id },
    parentJobId: job.id,
  });

  return { script_version_id: script.id, narrated_sections: narratedCount };
};
