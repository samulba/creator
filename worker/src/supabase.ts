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

/**
 * Hands a running/leased job back to the queue without burning an attempt —
 * used on graceful shutdown (deploys, scale-down): the interruption is an
 * infrastructure event, not a failure of the job. Requires migration 014;
 * on older schemas the RPC is missing and this throws (callers catch).
 */
export async function releaseJob(
  jobId: string,
  workerId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("release_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  if (error) throw new Error(`release_job failed: ${error.message}`);
  return Boolean(data);
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

// --- Story + script (Phase 6) --------------------------------------------

export type CandidateMomentRow = {
  id: string;
  analysis_run_id: string;
  moment_type: string;
  start_ms: number;
  end_ms: number;
  confidence: number | null;
  importance_score: number | null;
  title: string | null;
  summary: string | null;
  selection_reason: string | null;
};

/** The most recent completed analysis run for a project (summary + metrics). */
export async function loadLatestAnalysisRun(
  projectId: string,
): Promise<{ id: string; summary: string | null; metrics: Record<string, unknown> } | null> {
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, summary, metrics")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load analysis run failed: ${error.message}`);
  return (
    (data as { id: string; summary: string | null; metrics: Record<string, unknown> } | null) ??
    null
  );
}

/** Candidate moments for a project (optionally scoped to a run), best first. */
export async function loadCandidateMoments(
  projectId: string,
  analysisRunId?: string | null,
  limit = 60,
): Promise<CandidateMomentRow[]> {
  let query = supabase
    .from("candidate_moments")
    .select(
      "id, analysis_run_id, moment_type, start_ms, end_ms, confidence, importance_score, title, summary, selection_reason",
    )
    .eq("project_id", projectId)
    .neq("inclusion_state", "excluded");
  if (analysisRunId) query = query.eq("analysis_run_id", analysisRunId);
  const { data, error } = await query
    .order("importance_score", { ascending: false, nullsFirst: false })
    .order("start_ms", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`load candidate moments failed: ${error.message}`);
  return (data as CandidateMomentRow[] | null) ?? [];
}

/** Next 1-based version number for a per-project versioned table. */
export async function nextVersionNumber(
  table: string,
  projectId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`next version for ${table} failed: ${error.message}`);
  const current = (data as { version_number: number } | null)?.version_number ?? 0;
  return current + 1;
}

export async function createStoryVersion(
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("story_versions")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`create story version failed: ${error?.message ?? "no id"}`);
  }
  return (data as { id: string }).id;
}

/** Clear any existing selected story so a fresh one can be marked selected. */
export async function clearSelectedStories(projectId: string): Promise<void> {
  const { error } = await supabase
    .from("story_versions")
    .update({ is_selected: false })
    .eq("project_id", projectId)
    .eq("is_selected", true);
  if (error) throw new Error(`clear selected stories failed: ${error.message}`);
}

export async function insertStoryVersionMoments(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("story_version_moments").insert(rows);
  if (error) {
    throw new Error(`insert story version moments failed: ${error.message}`);
  }
}

export async function setSelectedStoryVersion(
  projectId: string,
  storyVersionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ selected_story_version_id: storyVersionId })
    .eq("id", projectId);
  if (error) throw new Error(`set selected story failed: ${error.message}`);
}

export async function loadSelectedStory(
  projectId: string,
): Promise<{
  id: string;
  title: string | null;
  angle: string | null;
  summary: string | null;
  structure: Record<string, unknown>;
} | null> {
  const { data, error } = await supabase
    .from("story_versions")
    .select("id, title, angle, summary, structure")
    .eq("project_id", projectId)
    .eq("is_selected", true)
    .maybeSingle();
  if (error) throw new Error(`load selected story failed: ${error.message}`);
  return (
    (data as {
      id: string;
      title: string | null;
      angle: string | null;
      summary: string | null;
      structure: Record<string, unknown>;
    } | null) ?? null
  );
}

/** Candidate moments referenced by a story version, in narrative order. */
export async function loadStoryBeats(
  storyVersionId: string,
): Promise<
  Array<{
    story_role: string;
    sort_order: number;
    candidate_moment_id: string;
    moment: CandidateMomentRow;
  }>
> {
  const { data, error } = await supabase
    .from("story_version_moments")
    .select(
      "story_role, sort_order, candidate_moment_id, candidate_moments!inner(id, analysis_run_id, moment_type, start_ms, end_ms, confidence, importance_score, title, summary, selection_reason)",
    )
    .eq("story_version_id", storyVersionId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`load story beats failed: ${error.message}`);
  const rows = (data as unknown as Array<{
    story_role: string;
    sort_order: number;
    candidate_moment_id: string;
    candidate_moments: CandidateMomentRow;
  }>) ?? [];
  return rows.map((r) => ({
    story_role: r.story_role,
    sort_order: r.sort_order,
    candidate_moment_id: r.candidate_moment_id,
    moment: r.candidate_moments,
  }));
}

export async function createScriptVersion(
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("script_versions")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`create script version failed: ${error?.message ?? "no id"}`);
  }
  return (data as { id: string }).id;
}

export async function updateScriptVersion(
  scriptVersionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("script_versions")
    .update(patch)
    .eq("id", scriptVersionId);
  if (error) throw new Error(`update script version failed: ${error.message}`);
}

export async function insertScriptSections(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("script_sections").insert(rows);
  if (error) throw new Error(`insert script sections failed: ${error.message}`);
}

/** The active creative settings row id (for linking a script version). */
export async function loadActiveCreativeSettingsId(
  projectId: string,
): Promise<string | null> {
  const settings = await loadActiveCreativeSettings(projectId);
  return settings?.id ?? null;
}

// --- Voice (Phase 7) ------------------------------------------------------

export type ScriptVersionRow = {
  id: string;
  project_id: string;
  language: string;
  narrator_config: Record<string, unknown>;
  generation_metadata: Record<string, unknown>;
};

export type ScriptSectionRow = {
  id: string;
  section_index: number;
  start_ms: number;
  end_ms: number;
  beat_label: string | null;
  text: string;
};

function selectScriptVersion(column: string, value: string) {
  return supabase
    .from("script_versions")
    .select("id, project_id, language, narrator_config, generation_metadata")
    .eq(column, value);
}

export async function loadScriptVersion(
  scriptVersionId: string,
): Promise<ScriptVersionRow | null> {
  const { data, error } = await selectScriptVersion("id", scriptVersionId)
    .maybeSingle();
  if (error) throw new Error(`load script version failed: ${error.message}`);
  return (data as ScriptVersionRow | null) ?? null;
}

export async function loadLatestScriptVersion(
  projectId: string,
): Promise<ScriptVersionRow | null> {
  const { data, error } = await selectScriptVersion("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load latest script version failed: ${error.message}`);
  return (data as ScriptVersionRow | null) ?? null;
}

export async function loadScriptSections(
  scriptVersionId: string,
): Promise<ScriptSectionRow[]> {
  const { data, error } = await supabase
    .from("script_sections")
    .select("id, section_index, start_ms, end_ms, beat_label, text")
    .eq("script_version_id", scriptVersionId)
    .eq("status", "active")
    .order("section_index", { ascending: true });
  if (error) throw new Error(`load script sections failed: ${error.message}`);
  return (data as ScriptSectionRow[] | null) ?? [];
}

/** Section ids that already have available narration (for idempotent re-runs). */
export async function loadNarratedSectionIds(
  sectionIds: string[],
): Promise<Set<string>> {
  if (sectionIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("narration_assets")
    .select("script_section_id")
    .in("script_section_id", sectionIds)
    .eq("status", "available");
  if (error) throw new Error(`load narrated sections failed: ${error.message}`);
  const rows = (data as { script_section_id: string }[] | null) ?? [];
  return new Set(rows.map((r) => r.script_section_id));
}

export async function insertNarrationAsset(
  row: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("narration_assets").insert(row);
  if (error) throw new Error(`insert narration asset failed: ${error.message}`);
}

// --- Edit (Phase 8) -------------------------------------------------------

export async function createEditVersion(
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("edit_versions")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`create edit version failed: ${error?.message ?? "no id"}`);
  }
  return (data as { id: string }).id;
}

export async function insertEditSegments(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("edit_segments").insert(rows);
  if (error) throw new Error(`insert edit segments failed: ${error.message}`);
}

// --- Render (Phase 9) -----------------------------------------------------

export type EditVersionRow = {
  id: string;
  story_version_id: string | null;
  script_version_id: string | null;
  creative_settings_id: string | null;
  timeline_duration_ms: number | null;
};

export type EditSegmentRow = {
  id: string;
  segment_index: number;
  output_start_ms: number;
  output_end_ms: number;
  source_start_ms: number | null;
  source_end_ms: number | null;
  script_section_id: string | null;
};

export async function loadEditVersion(
  editVersionId: string,
): Promise<EditVersionRow | null> {
  const { data, error } = await supabase
    .from("edit_versions")
    .select("id, story_version_id, script_version_id, creative_settings_id, timeline_duration_ms")
    .eq("id", editVersionId)
    .maybeSingle();
  if (error) throw new Error(`load edit version failed: ${error.message}`);
  return (data as EditVersionRow | null) ?? null;
}

export async function loadLatestEditVersion(
  projectId: string,
): Promise<EditVersionRow | null> {
  const { data, error } = await supabase
    .from("edit_versions")
    .select("id, story_version_id, script_version_id, creative_settings_id, timeline_duration_ms")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load latest edit version failed: ${error.message}`);
  return (data as EditVersionRow | null) ?? null;
}

export async function loadEditSegments(
  editVersionId: string,
): Promise<EditSegmentRow[]> {
  const { data, error } = await supabase
    .from("edit_segments")
    .select("id, segment_index, output_start_ms, output_end_ms, source_start_ms, source_end_ms, script_section_id")
    .eq("edit_version_id", editVersionId)
    .eq("included", true)
    .order("segment_index", { ascending: true });
  if (error) throw new Error(`load edit segments failed: ${error.message}`);
  return (data as EditSegmentRow[] | null) ?? [];
}

/** Map of script_section_id → available narration audio object key. */
export async function loadNarrationObjectKeys(
  sectionIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (sectionIds.length === 0) return result;

  const { data: narr, error: nErr } = await supabase
    .from("narration_assets")
    .select("script_section_id, asset_id")
    .in("script_section_id", sectionIds)
    .eq("status", "available");
  if (nErr) throw new Error(`load narration assets failed: ${nErr.message}`);
  const rows = (narr as { script_section_id: string; asset_id: string | null }[] | null) ?? [];

  const assetToSection = new Map<string, string>();
  for (const row of rows) {
    if (row.asset_id) assetToSection.set(row.asset_id, row.script_section_id);
  }
  if (assetToSection.size === 0) return result;

  const { data: assets, error: aErr } = await supabase
    .from("assets")
    .select("id, object_key")
    .in("id", [...assetToSection.keys()])
    .is("deleted_at", null);
  if (aErr) throw new Error(`load narration objects failed: ${aErr.message}`);
  for (const a of (assets as { id: string; object_key: string }[] | null) ?? []) {
    const sectionId = assetToSection.get(a.id);
    if (sectionId) result.set(sectionId, a.object_key);
  }
  return result;
}

export async function clearCurrentOutputVersions(
  projectId: string,
): Promise<void> {
  const { error } = await supabase
    .from("output_versions")
    .update({ is_current: false })
    .eq("project_id", projectId)
    .eq("is_current", true);
  if (error) throw new Error(`clear current outputs failed: ${error.message}`);
}

export async function loadOutputVersionByEdit(
  editVersionId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("output_versions")
    .select("id")
    .eq("edit_version_id", editVersionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load output version failed: ${error.message}`);
  return (data as { id: string } | null) ?? null;
}

export async function createOutputVersion(
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("output_versions")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`create output version failed: ${error?.message ?? "no id"}`);
  }
  return (data as { id: string }).id;
}

export async function updateOutputVersion(
  outputVersionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("output_versions")
    .update(patch)
    .eq("id", outputVersionId);
  if (error) throw new Error(`update output version failed: ${error.message}`);
}

export type OutputVersionRow = {
  id: string;
  project_id: string;
  status: string;
  qc_status: string;
  final_asset_id: string | null;
  edit_version_id: string | null;
  script_version_id: string | null;
  is_current: boolean;
};

export async function loadOutputVersion(
  outputVersionId: string,
): Promise<OutputVersionRow | null> {
  const { data, error } = await supabase
    .from("output_versions")
    .select(
      "id, project_id, status, qc_status, final_asset_id, edit_version_id, script_version_id, is_current",
    )
    .eq("id", outputVersionId)
    .maybeSingle();
  if (error) throw new Error(`load output version failed: ${error.message}`);
  return (data as OutputVersionRow | null) ?? null;
}

export async function loadAssetById(
  assetId: string,
  projectId: string,
): Promise<AssetRow | null> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`load asset failed: ${error.message}`);
  return (data as AssetRow | null) ?? null;
}

export async function nextRenderAttemptNumber(
  outputVersionId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("render_attempts")
    .select("attempt_number")
    .eq("output_version_id", outputVersionId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`next render attempt failed: ${error.message}`);
  return ((data as { attempt_number: number } | null)?.attempt_number ?? 0) + 1;
}

export async function createRenderAttempt(
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("render_attempts")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`create render attempt failed: ${error?.message ?? "no id"}`);
  }
  return (data as { id: string }).id;
}

export async function updateRenderAttempt(
  renderAttemptId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("render_attempts")
    .update(patch)
    .eq("id", renderAttemptId);
  if (error) throw new Error(`update render attempt failed: ${error.message}`);
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
