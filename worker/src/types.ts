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
