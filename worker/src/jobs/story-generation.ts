import {
  buildCreativeContext,
  buildPersonaContext,
} from "../ai/context.js";
import { getGenerativeProvider } from "../ai/index.js";
import { STORY_PROMPT_VERSION } from "../ai/story-schema.js";
import { ProviderError, type MomentBrief } from "../ai/types.js";
import {
  clearSelectedStories,
  createStoryVersion,
  enqueuePipelineJob,
  insertStoryVersionMoments,
  loadActiveCreativeSettings,
  loadCandidateMoments,
  loadCharacter,
  loadLatestAnalysisRun,
  loadProject,
  nextVersionNumber,
  setProjectState,
  setSelectedStoryVersion,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/**
 * Story director (Phase 6). Reads the grounded candidate moments from coarse
 * analysis and asks the model to choose the strongest narrative angle and the
 * moments that carry it. Writes a selected story_version + story_version_moments.
 * Pipeline stage: understanding_gameplay → building_story.
 */
export const storyGeneration: JobHandler = async (job, ctx) => {
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
    activity: "Choosing the strongest narrative",
  });
  await setProjectState(job.project_id, "building_story");

  const payload = job.payload as { analysis_run_id?: string };

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

  const run = await loadLatestAnalysisRun(job.project_id);
  const moments = await loadCandidateMoments(
    job.project_id,
    payload.analysis_run_id ?? run?.id ?? null,
  );
  if (moments.length === 0) {
    throw new JobError(
      "STORY_NO_MOMENTS",
      "There are no candidate moments to build a story from.",
      { retryable: false },
    );
  }

  const briefs: MomentBrief[] = moments.map((m, index) => ({
    index,
    momentType: m.moment_type,
    startMs: m.start_ms,
    endMs: m.end_ms,
    importance: m.importance_score,
    confidence: m.confidence,
    title: m.title,
    summary: m.summary,
    selectionReason: m.selection_reason,
  }));
  const matchContext =
    (run?.metrics?.match_context as Record<string, unknown> | undefined) ?? {};

  let result;
  try {
    result = await provider.generateStory(
      {
        projectTitle: project?.title ?? "Untitled",
        language: persona.language,
        persona,
        creative,
        analysisSummary: run?.summary ?? null,
        matchContext,
        moments: briefs,
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

  if (result.selections.length === 0) {
    throw new JobError(
      "STORY_EMPTY",
      "The story pass selected no moments.",
      { retryable: true },
    );
  }

  const versionNumber = await nextVersionNumber("story_versions", job.project_id);
  const generationMetadata = {
    provider: provider.id,
    model_id: provider.model,
    prompt_template_version: STORY_PROMPT_VERSION,
    character_id: persona.characterId,
    character_config_hash: persona.configHash,
    language: persona.language,
  };

  // Only one selected story per project (partial unique index).
  await clearSelectedStories(job.project_id);
  const storyId = await createStoryVersion({
    project_id: job.project_id,
    version_number: versionNumber,
    status: "generated",
    is_selected: true,
    title: result.title,
    angle: result.angle,
    summary: result.summary,
    structure: result.structure,
    generation_metadata: generationMetadata,
    created_by_job_id: job.id,
  });

  const links = result.selections
    .map((sel) => {
      const moment = moments[sel.momentIndex];
      if (!moment) return null;
      return {
        story_version_id: storyId,
        candidate_moment_id: moment.id,
        story_role: sel.storyRole,
        sort_order: sel.sortOrder,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  await insertStoryVersionMoments(links);
  await setSelectedStoryVersion(job.project_id, storyId);

  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "script_generation",
    idempotencyKey: `script-generation:${storyId}`,
    payload: { story_version_id: storyId },
    parentJobId: job.id,
  });

  return { story_version_id: storyId, selected_moments: links.length };
};
