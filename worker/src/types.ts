/**
 * Minimal database shapes the worker touches. Kept local so the worker
 * package stays self-contained; mirrors src/lib/supabase/database.types.ts
 * in the web app. Only the columns the worker reads/writes are listed.
 */

export type JobType =
  | "source_validation"
  | "media_probe"
  | "proxy_generation"
  | "coarse_analysis"
  | "candidate_detection"
  | "deep_analysis"
  | "story_generation"
  | "script_generation"
  | "voice_generation"
  | "edit_planning"
  | "render"
  | "quality_control"
  | "asset_deletion";

export type JobStatus =
  | "queued"
  | "leased"
  | "running"
  | "retry_scheduled"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ProcessingJob = {
  id: string;
  project_id: string;
  job_type: JobType;
  status: JobStatus;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string;
  payload: Record<string, unknown>;
  lease_owner: string | null;
};

export type AssetRow = {
  id: string;
  project_id: string;
  asset_type: string;
  status: string;
  bucket: string;
  object_key: string;
  original_filename: string | null;
  content_type: string | null;
  byte_size: number | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  frame_rate: number | null;
  video_codec: string | null;
  audio_codec: string | null;
  metadata: Record<string, unknown>;
};

/** Active creative settings snapshot for a project (migration 002). */
export type CreativeSettingsRow = {
  id: string;
  project_id: string;
  version_number: number;
  creative_direction: string;
  pacing: string;
  narration_density: string;
  gameplay_preservation: string;
  target_length: string;
  character_id: string | null;
  edit_style: Record<string, unknown>;
  is_active: boolean;
};

/** A reusable narrator identity (migration 002). No secrets — voice_key is an ID. */
export type CharacterRow = {
  id: string;
  user_id: string;
  name: string;
  language: string;
  voice_provider: string;
  voice_key: string | null;
  voice_settings: Record<string, unknown>;
  speech_style: Record<string, unknown>;
};

/** Minimal project fields the analysis step reads. */
export type ProjectRow = {
  id: string;
  title: string;
  target_language: string;
  channel_id: string | null;
  source_asset_id: string | null;
  pipeline_state: string;
  deleted_at: string | null;
};

/** Error thrown by a job handler to control retry behavior. */
export class JobError extends Error {
  code: string;
  retryable: boolean;
  failProject: boolean;
  details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: {
      retryable?: boolean;
      failProject?: boolean;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "JobError";
    this.code = code;
    this.retryable = options?.retryable ?? true;
    this.failProject = options?.failProject ?? true;
    this.details = options?.details ?? {};
  }
}
