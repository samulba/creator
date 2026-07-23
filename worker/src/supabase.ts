import { createClient } from "@supabase/supabase-js";

import { env } from "./env.js";
import type {
  AssetRow,
  CharacterRow,
  CreativeSettingsRow,
  ProcessingJob,
  ProjectRow,
} from "./types.js";

/**
 * Service-role Supabase client. Bypasses RLS — used only inside this
 * worker to claim jobs and write pipeline results. The service-role key
 * must never leave the worker environment.
 */
export const supabase = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

export async function claimNextJob(
  workerId: string,
  jobTypes: string[],
): Promise<ProcessingJob | null> {
  const { data, error } = await supabase.rpc("claim_next_job", {
    p_worker_id: workerId,
    p_job_types: jobTypes,
    p_lease_seconds: env.leaseSeconds,
  });

  if (error) {
    throw new Error(`claim_next_job failed: ${error.message}`);
  }

  const rows = (data ?? []) as ProcessingJob[];
  return rows[0] ?? null;
}

export async function startJob(jobId: string, workerId: string): Promise<void> {
  const { error } = await supabase.rpc("start_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  if (error) throw new Error(`start_job failed: ${error.message}`);
}

export async function heartbeatJob(
  jobId: string,
  workerId: string,
  progress: {
    percent?: number | null;
    stage?: string | null;
    activity?: string | null;
  } = {},
): Promise<void> {
  const { error } = await supabase.rpc("heartbeat_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_lease_seconds: env.leaseSeconds,
    p_progress_percent: progress.percent ?? null,
    p_progress_stage: progress.stage ?? null,
    p_current_activity: progress.activity ?? null,
  });
  if (error) throw new Error(`heartbeat_job failed: ${error.message}`);
}

export async function completeJob(
  jobId: string,
  workerId: string,
  result: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.rpc("complete_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_result: result,
  });
  if (error) throw new Error(`complete_job failed: ${error.message}`);
}

export async function failJob(
  jobId: string,
  workerId: string,
  input: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
    failProject: boolean;
  },
): Promise<void> {
  const { error } = await supabase.rpc("fail_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_error_code: input.code,
    p_error_message: input.message,
    p_error_details: input.details ?? {},
    p_retryable: input.retryable,
    p_fail_project: input.failProject,
  });
  if (error) throw new Error(`fail_job failed: ${error.message}`);
}

/**
 * Enqueues the next pipeline job. The worker uses service-role, which
 * bypasses RLS, so it inserts directly with an idempotency key rather than
 * going through the user-facing enqueue_job RPC (that RPC only permits
 * source_validation). ON CONFLICT keeps re-runs idempotent.
 */
export async function enqueuePipelineJob(input: {
  projectId: string;
  jobType: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  parentJobId?: string;
}): Promise<void> {
  const { error } = await supabase.from("processing_jobs").upsert(
    {
      project_id: input.projectId,
      job_type: input.jobType,
      idempotency_key: input.idempotencyKey,
      payload: input.payload ?? {},
      parent_job_id: input.parentJobId ?? null,
    },
    { onConflict: "project_id,job_type,idempotency_key", ignoreDuplicates: true },
  );
  if (error) throw new Error(`enqueue ${input.jobType} failed: ${error.message}`);
}

export async function setProjectState(
  projectId: string,
  pipelineState: string,
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ pipeline_state: pipelineState })
    .eq("id", projectId)
    .is("deleted_at", null);
  if (error) throw new Error(`set project state failed: ${error.message}`);
}

export async function loadOriginalSource(
  projectId: string,
): Promise<AssetRow | null> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .eq("asset_type", "original_source")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`load source asset failed: ${error.message}`);
  return (data as AssetRow | null) ?? null;
}

export async function updateAsset(
  assetId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("assets")
    .update(patch)
    .eq("id", assetId);
  if (error) throw new Error(`update asset failed: ${error.message}`);
}

export async function insertAsset(
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("assets")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`insert asset failed: ${error?.message ?? "no id"}`);
  }
  return (data as { id: string }).id;
}

export async function loadProject(projectId: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, title, target_language, channel_id, source_asset_id, pipeline_state, deleted_at",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`load project failed: ${error.message}`);
  return (data as ProjectRow | null) ?? null;
}

/** The project's active creative settings snapshot (the frozen v1 dials). */
export async function loadActiveCreativeSettings(
  projectId: string,
): Promise<CreativeSettingsRow | null> {
  const { data, error } = await supabase
    .from("project_creative_settings")
    .select(
      "id, project_id, version_number, creative_direction, pacing, narration_density, gameplay_preservation, target_length, character_id, edit_style, is_active",
    )
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load creative settings failed: ${error.message}`);
  return (data as CreativeSettingsRow | null) ?? null;
}

export async function loadCharacter(
  characterId: string,
): Promise<CharacterRow | null> {
  const { data, error } = await supabase
    .from("characters")
    .select(
      "id, user_id, name, language, voice_provider, voice_key, voice_settings, speech_style",
    )
    .eq("id", characterId)
    .maybeSingle();
  if (error) throw new Error(`load character failed: ${error.message}`);
  return (data as CharacterRow | null) ?? null;
}

/**
 * The analysis proxy for a project. Prefers a specific asset id (from the job
 * payload) and falls back to the most recent available proxy_video.
 */
export async function loadProxyAsset(
  projectId: string,
  proxyAssetId?: string | null,
): Promise<AssetRow | null> {
  if (proxyAssetId) {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", proxyAssetId)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(`load proxy asset failed: ${error.message}`);
    if (data) return data as AssetRow;
  }

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .eq("asset_type", "proxy_video")
    .eq("status", "available")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load proxy asset failed: ${error.message}`);
  return (data as AssetRow | null) ?? null;
}

export async function createAnalysisRun(row: {
  projectId: string;
  runType: string;
  sourceAssetId: string | null;
  proxyAssetId: string | null;
  modelMetadata: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabase
    .from("analysis_runs")
    .insert({
      project_id: row.projectId,
      run_type: row.runType,
      status: "running",
      source_asset_id: row.sourceAssetId,
      proxy_asset_id: row.proxyAssetId,
      model_metadata: row.modelMetadata,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`create analysis run failed: ${error?.message ?? "no id"}`);
  }
  return (data as { id: string }).id;
}

export async function updateAnalysisRun(
  runId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("analysis_runs")
    .update(patch)
    .eq("id", runId);
  if (error) throw new Error(`update analysis run failed: ${error.message}`);
}

export async function insertGameplayEvents(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("gameplay_events").insert(rows);
  if (error) throw new Error(`insert gameplay events failed: ${error.message}`);
}

export async function insertCandidateMoments(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("candidate_moments").insert(rows);
  if (error) {
    throw new Error(`insert candidate moments failed: ${error.message}`);
  }
}

export async function insertCandidateMomentEvents(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("candidate_moment_events")
    .insert(rows);
  if (error) {
    throw new Error(`insert candidate moment events failed: ${error.message}`);
  }
}

/** True when the project was cancelled/deleted while a job was running. */
export async function isProjectActive(projectId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("projects")
    .select("pipeline_state, deleted_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`load project failed: ${error.message}`);
  if (!data) return false;
  const row = data as { pipeline_state: string; deleted_at: string | null };
  return row.deleted_at === null && row.pipeline_state !== "cancelled";
}
