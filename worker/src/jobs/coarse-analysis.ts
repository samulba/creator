import { randomUUID } from "node:crypto";

import {
  buildCreativeContext,
  buildPersonaContext,
} from "../ai/context.js";
import { getAnalysisProvider } from "../ai/index.js";
import { PROMPT_TEMPLATE_VERSION } from "../ai/schema.js";
import { ProviderError, type CoarseAnalysisResult } from "../ai/types.js";
import { presignGet } from "../r2.js";
import {
  createAnalysisRun,
  enqueuePipelineJob,
  insertCandidateMomentEvents,
  insertCandidateMoments,
  insertGameplayEvents,
  loadActiveCreativeSettings,
  loadCharacter,
  loadProject,
  loadProxyAsset,
  updateAnalysisRun,
} from "../supabase.js";
import { JobError } from "../types.js";

import type { JobHandler } from "./index.js";

/**
 * Coarse gameplay analysis (Phase 5). Sends the analysis proxy to the
 * configured AI provider (Gemini), validates the structured result, and
 * records it into analysis_runs / gameplay_events / candidate_moments.
 * Pipeline stage: understanding_gameplay.
 *
 * Consistency provenance: the resolved character config hash, model id, and
 * prompt template version are stamped on the analysis run so a video always
 * traces back to the exact persona and model it was built from.
 */
export const coarseAnalysis: JobHandler = async (job, ctx) => {
  const provider = getAnalysisProvider();
  if (!provider) {
    // Should not happen — this handler is only registered when a provider is
    // configured. Fail softly without marking the project failed so the job
    // can run once a key is present.
    throw new JobError(
      "ANALYSIS_NOT_CONFIGURED",
      "No analysis provider is configured on this worker.",
      { retryable: true, failProject: false },
    );
  }

  await ctx.heartbeat({
    stage: "analyzing_gameplay",
    activity: "Understanding what happens in the match",
  });

  const payload = job.payload as {
    proxy_asset_id?: string;
    source_asset_id?: string;
  };

  const proxy = await loadProxyAsset(job.project_id, payload.proxy_asset_id);
  if (!proxy) {
    throw new JobError(
      "PROXY_MISSING",
      "No analysis proxy was found for this project.",
      { retryable: false },
    );
  }

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

  const modelMetadata = {
    provider: provider.id,
    model_id: provider.model,
    prompt_template_version: PROMPT_TEMPLATE_VERSION,
    character_id: persona.characterId,
    character_config_hash: persona.configHash,
    language: persona.language,
    proxy_asset_id: proxy.id,
    source_asset_id: payload.source_asset_id ?? project?.source_asset_id ?? null,
  };

  const runId = await createAnalysisRun({
    projectId: job.project_id,
    runType: "coarse",
    sourceAssetId: payload.source_asset_id ?? project?.source_asset_id ?? null,
    proxyAssetId: proxy.id,
    modelMetadata,
  });

  const startedAt = Date.now();
  let result: CoarseAnalysisResult;
  try {
    const proxyUrl = await presignGet(proxy.object_key);
    result = await provider.analyzeCoarse(
      {
        projectTitle: project?.title ?? "Untitled",
        proxyUrl,
        proxyObjectKey: proxy.object_key,
        proxyMimeType: proxy.content_type ?? "video/mp4",
        durationMs: proxy.duration_ms,
        persona,
        creative,
      },
      (note) => {
        void ctx
          .heartbeat({ stage: "analyzing_gameplay", activity: note })
          .catch(() => {});
      },
    );
  } catch (error) {
    await markRunFailed(runId, error);
    if (error instanceof ProviderError) {
      throw new JobError(error.code, error.message, {
        retryable: error.retryable,
        details: error.details,
      });
    }
    throw error;
  }

  if (result.events.length === 0 && result.moments.length === 0) {
    await markRunFailed(runId, new Error("empty analysis"));
    throw new JobError(
      "ANALYSIS_EMPTY",
      "The analysis produced no usable events.",
      { retryable: true },
    );
  }

  // Assign ids client-side so moment→event links are unambiguous.
  const eventIds = result.events.map(() => randomUUID());
  await insertGameplayEvents(
    result.events.map((event, index) => ({
      id: eventIds[index],
      project_id: job.project_id,
      analysis_run_id: runId,
      event_type: event.eventType,
      start_ms: event.startMs,
      end_ms: event.endMs,
      confidence: event.confidence,
      importance_score: event.importance,
      title: event.title,
      summary: event.summary,
      actor_labels: event.actorLabels,
    })),
  );

  const momentIds = result.moments.map(() => randomUUID());
  await insertCandidateMoments(
    result.moments.map((moment, index) => ({
      id: momentIds[index],
      project_id: job.project_id,
      analysis_run_id: runId,
      moment_type: moment.momentType,
      start_ms: moment.startMs,
      end_ms: moment.endMs,
      confidence: moment.confidence,
      importance_score: moment.importance,
      title: moment.title,
      summary: moment.summary,
      selection_reason: moment.selectionReason,
      inclusion_state: "candidate",
    })),
  );

  const links: Record<string, unknown>[] = [];
  result.moments.forEach((moment, index) => {
    const momentId = momentIds[index];
    for (const eventIndex of moment.supportingEventIndices) {
      const gameplayEventId = eventIds[eventIndex];
      if (gameplayEventId) {
        links.push({
          candidate_moment_id: momentId,
          gameplay_event_id: gameplayEventId,
          relationship: "supports",
        });
      }
    }
  });
  await insertCandidateMomentEvents(links);

  await updateAnalysisRun(runId, {
    status: "completed",
    summary: result.summary,
    completed_at: new Date().toISOString(),
    metrics: {
      event_count: result.events.length,
      moment_count: result.moments.length,
      link_count: links.length,
      analysis_ms: Date.now() - startedAt,
      proxy_duration_ms: proxy.duration_ms,
      match_context: result.matchContext,
    },
  });

  // Understanding continues with a deep pass over the strongest candidates
  // (handler arrives in a later phase — stays queued until then).
  await enqueuePipelineJob({
    projectId: job.project_id,
    jobType: "deep_analysis",
    idempotencyKey: `deep-analysis:${runId}`,
    payload: { analysis_run_id: runId, proxy_asset_id: proxy.id },
    parentJobId: job.id,
  });

  return {
    analysis_run_id: runId,
    event_count: result.events.length,
    moment_count: result.moments.length,
  };
};

async function markRunFailed(runId: string, error: unknown): Promise<void> {
  const reason =
    error instanceof Error ? error.message : "unknown analysis error";
  await updateAnalysisRun(runId, {
    status: "failed",
    completed_at: new Date().toISOString(),
    metrics: { error: reason },
  }).catch(() => {});
}
