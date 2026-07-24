import {
  buildCreativeContext,
  buildPersonaContext,
  countCatchphrases,
  findForbiddenViolations,
} from "../ai/context.js";
import { getGenerativeProvider } from "../ai/index.js";
import { SCRIPT_PROMPT_VERSION } from "../ai/story-schema.js";
import { ProviderError, type ScriptBeat } from "../ai/types.js";
import {
  createScriptVersion,
  enqueuePipelineJob,
  insertScriptSections,
  loadActiveCreativeSettings,
  loadCharacter,
  loadProject,
  loadProxyAsset,
  loadSelectedStory,
  loadStoryBeats,
  nextVersionNumber,
  setProjectState,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/**
 * Script writer (Phase 6). Turns the selected story + its beats into
 * timestamp-aware narration in the character's voice, then freezes the
 * resolved character config into script_versions.narrator_config (second
 * consistency freeze point). forbidden_words are enforced hard; catchphrase
 * usage is recorded as a soft budget. Pipeline stage: building_story →
 * generating_voice.
 */
export const scriptGeneration: JobHandler = async (job, ctx) => {
  const provider = getGenerativeProvider();
  if (!provider) {
    throw new JobError(
      "AI_NOT_CONFIGURED",
      "No generative provider is configured on this worker.",
      { retryable: true, failProject: false },
    );
  }

  await ctx.heartbeat({
    stage: "building_story",
    activity: "Writing the narration script",
  });

  const project = await loadProject(job.project_id);
  const settings = await loadActiveCreativeSettings(job.project_id);
  const character = settings?.character_id
    ? await loadCharacter(settings.character_id)
    : null;
  const persona = buildPersonaContext(
    character,
    project?.target_language ?? "en",
  );
  const creative = buildCreativeContext(settings);

  const story = await loadSelectedStory(job.project_id);
  if (!story) {
    throw new JobError(
      "SCRIPT_NO_STORY",
      "No selected story was found for this project.",
      { retryable: false },
    );
  }

  const beatRows = await loadStoryBeats(story.id);
  if (beatRows.length === 0) {
    throw new JobError(
      "SCRIPT_NO_BEATS",
      "The selected story has no moments to script.",
      { retryable: false },
    );
  }

  const proxy = await loadProxyAsset(job.project_id);
  const durationMs = proxy?.duration_ms ?? null;

  const beats: ScriptBeat[] = beatRows.map((b) => ({
    momentIndex: 0,
    storyRole: b.story_role,
    sortOrder: b.sort_order,
    momentType: b.moment.moment_type,
    startMs: b.moment.start_ms,
    endMs: b.moment.end_ms,
    title: b.moment.title,
    summary: b.moment.summary,
  }));

  // Per-beat spoken-word budget: the room a line has is the CHRONOLOGICAL
  // gap to the next narrated moment (the edit keeps the match in order), at
  // a spoken pace of ~2.3 words/second, capped so no line becomes a lecture.
  const chronological = [...beats].sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < chronological.length; i += 1) {
    const beat = chronological[i]!;
    const nextStart = chronological[i + 1]?.startMs ?? beat.endMs + 15_000;
    const windowMs = Math.min(15_000, Math.max(3_500, nextStart - beat.startMs));
    beat.maxWords = Math.max(8, Math.round((windowMs / 1000) * 2.3));
  }

  let result;
  try {
    result = await provider.generateScript(
      {
        projectTitle: project?.title ?? "Untitled",
        language: persona.language,
        durationMs,
        persona,
        creative,
        story: {
          title: story.title,
          angle: story.angle,
          summary: story.summary,
          structure: story.structure,
        },
        beats,
      },
      (note) => {
        void ctx.heartbeat({ stage: "building_story", activity: note }).catch(() => {});
      },
    );
  } catch (error) {
    if (error instanceof ProviderError) {
      throw new JobError(error.code, error.message, {
        retryable: error.retryable,
        details: error.details,
      });
    }
    throw error;
  }

  if (result.sections.length === 0) {
    throw new JobError("SCRIPT_EMPTY", "The script pass produced no sections.", {
      retryable: true,
    });
  }

  // Hard constraint: never ship narration containing forbidden words.
  const violations = findForbiddenViolations(
    result.fullText,
    persona.forbiddenWords,
  );
  if (violations.length > 0) {
    throw new JobError(
      "SCRIPT_FORBIDDEN_WORDS",
      "The script used words the character forbids.",
      { retryable: true, details: { words: violations } },
    );
  }
  const catchphraseCounts = countCatchphrases(
    result.fullText,
    persona.catchphrases,
  );

  // Second freeze point: pin the resolved character config to this script.
  const narratorConfig = {
    character_id: persona.characterId,
    name: persona.name,
    language: persona.language,
    voice_provider: character?.voice_provider ?? null,
    voice_key: character?.voice_key ?? null,
    voice_settings: character?.voice_settings ?? {},
    speech_style: character?.speech_style ?? {},
  };

  const versionNumber = await nextVersionNumber(
    "script_versions",
    job.project_id,
  );
  const generationMetadata = {
    provider: provider.id,
    model_id: provider.model,
    prompt_template_version: SCRIPT_PROMPT_VERSION,
    character_id: persona.characterId,
    character_config_hash: persona.configHash,
    language: persona.language,
    catchphrase_counts: catchphraseCounts,
    section_count: result.sections.length,
  };

  const scriptId = await createScriptVersion({
    project_id: job.project_id,
    story_version_id: story.id,
    creative_settings_id: settings?.id ?? null,
    version_number: versionNumber,
    status: "generated",
    language: persona.language,
    character_id: persona.characterId,
    narrator_config: narratorConfig,
    full_text: result.fullText,
    generation_metadata: generationMetadata,
    created_by_job_id: job.id,
  });

  await insertScriptSections(
    result.sections.map((section) => ({
      project_id: job.project_id,
      script_version_id: scriptId,
      section_index: section.sectionIndex,
      start_ms: section.startMs,
      end_ms: section.endMs,
      beat_label: section.beatLabel,
      text: section.text,
      status: "active",
    })),
  );

  await setProjectState(job.project_id, "generating_voice");
  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "voice_generation",
    idempotencyKey: `voice-generation:${scriptId}`,
    payload: { script_version_id: scriptId },
    parentJobId: job.id,
  });

  return { script_version_id: scriptId, section_count: result.sections.length };
};
