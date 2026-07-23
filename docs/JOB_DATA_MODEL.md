# Creator — Job Data Model

## Purpose

Creator uses durable asynchronous jobs for upload validation, video processing, AI generation, voice generation, rendering, quality control, and cleanup. This document defines the job model independently from any specific queue provider.

## Core Table

The MVP job table is `processing_jobs`.

A job always belongs to a project. Jobs may be chained through `parent_job_id` and may create or update assets, analysis records, story versions, scripts, edit versions, output versions, render attempts, and quality checks.

## Job Types

Recommended MVP `job_type` values:

- `source_validation`
- `media_probe`
- `proxy_generation`
- `coarse_analysis`
- `candidate_detection`
- `deep_analysis`
- `story_generation`
- `script_generation`
- `voice_generation`
- `edit_planning`
- `render`
- `quality_control`
- `asset_deletion`

These map to the documented pipeline without exposing queue internals to users.

## Job Statuses

Recommended `job_status` values:

- `queued` — waiting to be claimed
- `leased` — claimed by a worker but not yet running
- `running` — active work is underway
- `retry_scheduled` — failed attempt will be retried later
- `succeeded` — completed successfully
- `failed` — terminal failure after retry policy or non-retryable error
- `cancelled` — intentionally stopped

## Required Fields

Each job should track:

- `project_id`
- `job_type`
- `status`
- `priority`
- `attempt_count`
- `max_attempts`
- `idempotency_key`
- `parent_job_id`
- `scheduled_at`
- `lease_owner`
- `lease_expires_at`
- `progress_percent`
- `progress_stage`
- `current_activity`
- `payload`
- `result`
- `error_code`
- `error_message`
- `error_details`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

## Idempotency

Every job enqueue operation must provide a deterministic `idempotency_key` scoped to project and job type. Examples:

- `source-validation:{source_asset_id}`
- `media-probe:{source_asset_id}`
- `proxy-generation:{source_asset_id}:v1`
- `coarse-analysis:{analysis_run_id}`
- `voice-generation:{script_version_id}:section:{script_section_id}`
- `render:{output_version_id}:edit:{edit_version_id}`
- `asset-deletion:{asset_id}`

The database should enforce unique `(project_id, job_type, idempotency_key)` to prevent duplicate destructive work.

## Payload Rules

Job `payload` is JSONB but not arbitrary. It must be schema-validated before insertion and before execution. Payload may contain:

- IDs of project records to process
- processing options
- expected input asset IDs
- output version IDs
- schema version numbers

Payload must not contain:

- secrets
- signed URLs
- raw provider credentials
- complete unbounded AI prompts/responses unless explicitly sanitized and size-limited
- trusted user ownership claims

## Result Rules

Job `result` stores sanitized structured output summaries useful to the next pipeline step. Durable domain data must be stored in domain tables rather than only in `result`.

For example:

- media probe metadata belongs on `assets.metadata` and typed media columns
- detected events belong in `gameplay_events`
- moments belong in `candidate_moments`
- scripts belong in `script_versions` and `script_sections`
- final media references belong in `assets`, `render_attempts`, and `output_versions`

## Leasing Model

Workers should claim jobs through a privileged database RPC or equivalent server-only queue adapter.

Lifecycle:

1. `queued` or eligible `retry_scheduled` job is selected with row lock.
2. Claim sets `status = 'leased'`, `lease_owner`, `lease_expires_at`.
3. Worker validates payload and sets `status = 'running'`, increments `attempt_count`, and sets `started_at` if first attempt.
4. Worker periodically extends lease while active.
5. Completion writes domain records and job result in one transaction where practical.
6. Failure writes safe error fields and either schedules retry or marks terminal failed.

Expired leases may be reclaimed only if the job type is idempotent or has compensating safeguards.

## Retry Policy

Default `max_attempts = 3`, but set per job type.

Retry-safe examples:

- media probe
- proxy generation if output asset keys are deterministic per attempt or cleaned up safely
- AI calls if outputs are versioned and idempotency prevents duplicates
- rendering if render attempts are versioned
- quality control

Retry-sensitive examples:

- asset deletion must handle missing objects as success only after verifying the object no longer exists
- approval or user decision actions should not be jobs that can duplicate state changes

Failures must preserve completed prior pipeline outputs. A render failure should not erase analysis, story, or scripts.

## Progress Model

Use `progress_percent` only for measurable tasks such as upload, FFmpeg transcode progress, or render progress where reliable. For AI stages, use semantic progress fields:

- `progress_stage`
- `current_activity`

The project `pipeline_state` is the primary user-facing source. Job progress is supporting detail.

## Error Model

Separate safe user messages from support details:

- `error_code`: stable internal/support code
- `error_message`: safe summary suitable for UI after sanitization
- `error_details`: support-only JSONB; do not expose directly to browser

Do not store raw stack traces, provider secrets, complete signed URLs, or private headers in job rows.

## Project State Transitions

Jobs may advance `projects.pipeline_state`, but only through controlled server/worker logic. Examples:

- source validation starts: `validating_source`
- media probe/proxy: `probing_media` / `generating_proxy`
- analysis jobs: `analyzing_gameplay`, `detecting_moments`, `deep_analysis`
- story/script/voice/edit/render/QC jobs map to their corresponding pipeline states
- successful QC sets `ready_for_review`
- terminal failure sets `failed` with safe failure fields

Project state and job status must not contradict each other. If a job fails terminally, the project failure fields should identify the failed stage.

## Cancellation

User cancellation is requested through server API. Server should:

1. validate ownership
2. set project state to `cancelled` when safe
3. cancel queued jobs
4. mark running jobs as cancellation-requested through job payload/result or a separate field if needed
5. allow workers to stop cooperatively

Do not interrupt file writes unsafely. Workers should clean temporary files and avoid publishing partial assets as available.

## User Visibility

Normal users may see:

- semantic project state
- current stage
- current activity
- safe failure message
- completed stages

Normal users should not see:

- worker ids
- lease timestamps
- queue internals
- raw payloads
- raw error details
- provider request ids unless support explicitly needs them
