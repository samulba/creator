# Creator — Database Schema Specification

## Purpose

This document specifies the implementation-ready Supabase/Postgres schema for Creator. It intentionally does not include executable migrations. A later task should translate this specification into version-controlled SQL migrations.

## Global Conventions

### Schemas

Use the default `public` schema for application tables. Supabase Auth remains in `auth`.

### Primary keys

Use UUID primary keys with `gen_random_uuid()` for application tables except `profiles.id`, which equals `auth.users.id`.

### Timestamps

Every mutable table should include:

- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Use a migration-defined trigger to maintain `updated_at`. Add domain-specific timestamps such as `started_at`, `completed_at`, `approved_at`, `archived_at`, `deleted_at`, and `lease_expires_at` where appropriate.

### Enum strategy

Use Postgres enums for stable, low-cardinality state values that are used across constraints and UI mapping. Use check-constrained text for values likely to evolve frequently during early product development. Do not use unconstrained text for statuses.

Recommended enums:

- `project_pipeline_state`
- `job_status`
- `job_type`
- `asset_type`
- `asset_status`
- `analysis_run_status`
- `story_status`
- `script_status`
- `edit_status`
- `output_version_status`
- `render_status`
- `qc_status`

### JSONB usage

JSONB columns must be bounded by application-level schema validation and should have comments documenting the expected shape. Use JSONB for provider metadata, structured EDL details, technical probe metadata, and validated AI details that are not primary query dimensions.

### Time values

Store media times as integer milliseconds (`integer` or `bigint` depending on expected duration). Use non-negative check constraints and `end_ms > start_ms` constraints for ranges.

### Ownership

Most child tables contain both `project_id` and any specific parent foreign key. This is intentional: it simplifies RLS, indexing, and project-scoped queries. Application code and database constraints must ensure child rows reference parents from the same project.

## Table Specifications

### `profiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key references auth.users(id) on delete cascade` | Same as Supabase Auth user id. |
| `display_name` | `text null` | User-visible name. |
| `default_language` | `text not null default 'en'` | BCP-47 language tag preferred. |
| `default_narrator_key` | `text null` | **Deprecated** — superseded by `default_character_id`; dropped in a later migration. |
| `default_character_id` | `uuid null` | Composite FK `(default_character_id, id) references characters(id, user_id) on delete set null (default_character_id)`. |
| `preferences` | `jsonb not null default '{}'` | Small validated app preferences only. |
| `created_at` | `timestamptz not null default now()` |  |
| `updated_at` | `timestamptz not null default now()` |  |

Indexes: primary key only for MVP.

### `projects`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |  |
| `user_id` | `uuid not null references auth.users(id) on delete restrict` | Owner. Set server-side from authenticated user. |
| `title` | `text not null` | User-visible title. |
| `description` | `text null` | Optional user notes. |
| `pipeline_state` | `project_pipeline_state not null default 'draft'` | Canonical internal state. |
| `channel_id` | `uuid null` | Composite FK `(channel_id, user_id) references channels(id, user_id) on delete set null (channel_id)`. Applied in migration 002. |
| `source_asset_id` | `uuid null` | FK to `assets.id`, added after assets table exists. Use `on delete set null`. |
| `active_creative_settings_id` | `uuid null` | FK to `project_creative_settings.id`. |
| `selected_story_version_id` | `uuid null` | FK to `story_versions.id`. |
| `current_output_version_id` | `uuid null` | FK to `output_versions.id`. |
| `approved_output_version_id` | `uuid null` | FK to `output_versions.id`. |
| `target_language` | `text not null default 'en'` | Project-level generation language. |
| `failure_code` | `text null` | Stable support code. |
| `failure_message` | `text null` | Safe user-facing summary. |
| `archived_at` | `timestamptz null` | Hidden from active lists. |
| `delete_requested_at` | `timestamptz null` | Soft-deletion workflow starts. |
| `deleted_at` | `timestamptz null` | Logical deletion completed after storage cleanup. |
| `created_at` | `timestamptz not null default now()` |  |
| `updated_at` | `timestamptz not null default now()` |  |

Key constraints:

- `title` length between 1 and 200 characters.
- `deleted_at is null or delete_requested_at is not null`.
- selected/current/approved foreign keys must reference rows from the same project; enforce with composite FKs where practical or validated triggers.

Indexes:

- `(user_id, updated_at desc)`
- `(user_id, pipeline_state, updated_at desc)`
- partial `(user_id, updated_at desc) where archived_at is null and deleted_at is null`

### `project_creative_settings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |  |
| `project_id` | `uuid not null references projects(id) on delete cascade` |  |
| `version_number` | `integer not null` | Monotonic per project. |
| `creative_direction` | `text not null` | Check: balanced/funnier/more_dramatic/more_analytical. |
| `pacing` | `text not null default 'balanced'` | Check: relaxed/balanced/tight. |
| `narration_density` | `text not null default 'balanced'` | Check: light/balanced/detailed. |
| `gameplay_preservation` | `text not null default 'balanced'` | Check: preserve_more/balanced/cut_more_aggressively. |
| `target_length` | `text not null default 'auto'` | Check: auto/shorter/standard/longer. |
| `character_id` | `uuid null references characters(id) on delete set null` | Narrator character (by reference until generation). Ownership enforced via RLS `with check` + server validation. Applied in migration 002. |
| `edit_style` | `jsonb not null default '{}'` | Edit-style snapshot copied from the channel at project creation. Same keys as `channels.edit_style`. Applied in migration 002. |
| `is_active` | `boolean not null default true` | One active row per project. |
| `created_by` | `uuid null references auth.users(id) on delete set null` | User or null for system. |
| `created_at` | `timestamptz not null default now()` |  |

Constraints/indexes:

- unique `(project_id, version_number)`
- unique partial `(project_id) where is_active`
- index `(project_id, created_at desc)`

### `characters`

Reusable narrator identities — a user-level library shared across channels. See `docs/CHANNEL_CHARACTER_MODEL.md`. Applied in migration 002.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |  |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` | Owner. |
| `name` | `text not null` | Check 1–120. Case-insensitive unique per user while not archived. |
| `description` | `text null` | Check ≤ 2000. |
| `language` | `text not null default 'en'` | Character's primary language. |
| `voice_provider` | `text not null default 'elevenlabs'` | Check-constrained text. |
| `voice_key` | `text null` | Provider voice id (not a secret). Nullable until Phase 7 assigns voices. |
| `voice_settings` | `jsonb not null default '{}'` | Object. Keys: `model_id`, `stability`, `similarity_boost`, `style`, `speed`. |
| `speech_style` | `jsonb not null default '{}'` | Object. Keys: `tone`, `humor_level`, `energy`, `sentence_length`, `vocabulary_notes`, `catchphrases[]`, `forbidden_words[]`, `example_lines[]`. |
| `archived_at` | `timestamptz null` | Archive-first lifecycle. |
| `created_at` / `updated_at` | `timestamptz not null default now()` | `set_updated_at` trigger. |

Constraints/indexes: `unique (id, user_id)` (composite-FK target), partial unique `(user_id, lower(name)) where archived_at is null`, index `(user_id)`. RLS: owner-scoped select/insert/update/delete.

### `channels`

The user's YouTube channels: creative defaults plus edit-style branding. Applied in migration 002.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |  |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` | Owner. |
| `name` | `text not null` | Check 1–120. Case-insensitive unique per user while not archived. |
| `youtube_handle` | `text null` | Check ≤ 100. |
| `description` | `text null` | Check ≤ 2000. |
| `default_character_id` | `uuid null` | Composite FK `(default_character_id, user_id) references characters(id, user_id) on delete set null (default_character_id)` — same-owner enforced at DB level. |
| `default_language` | `text not null default 'en'` |  |
| `creative_direction` … `target_length` | as in `project_creative_settings` | The five creative dials, identical checks. Copied by value into settings at project creation. |
| `edit_style` | `jsonb not null default '{}'` | Object of enumerated tokens. Keys: `caption_style`, `zoom_usage`, `transition_style`, `intro_style`, `outro_style`. |
| `archived_at` | `timestamptz null` |  |
| `created_at` / `updated_at` | `timestamptz not null default now()` | `set_updated_at` trigger. |

Constraints/indexes: `unique (id, user_id)`, partial unique `(user_id, lower(name)) where archived_at is null`, index `(user_id)`. RLS: owner-scoped select/insert/update/delete.

### `assets`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |  |
| `project_id` | `uuid not null references projects(id) on delete cascade` |  |
| `asset_type` | `asset_type not null` | original_source, proxy_video, extracted_audio, frame_samples, narration_audio, intermediate_render, final_video, captions, preview_image. |
| `status` | `asset_status not null default 'pending'` | pending/uploading/available/failed/delete_pending/deleted. |
| `storage_provider` | `text not null default 'r2'` | MVP only R2. |
| `bucket` | `text not null` | Private bucket name/key alias, not secret. |
| `object_key` | `text not null` | Server-generated R2 key. |
| `original_filename` | `text null` | Display only; never trusted for paths. |
| `content_type` | `text null` | MIME type. |
| `byte_size` | `bigint null` | Check non-negative. |
| `checksum_sha256` | `text null` | Integrity when available. |
| `duration_ms` | `integer null` | Media duration. |
| `width` | `integer null` | Video/image width. |
| `height` | `integer null` | Video/image height. |
| `frame_rate` | `numeric null` |  |
| `video_codec` | `text null` |  |
| `audio_codec` | `text null` |  |
| `metadata` | `jsonb not null default '{}'` | Probe details, manifest details, or generated asset metadata. |
| `created_by_job_id` | `uuid null` | FK to `processing_jobs.id`, add after jobs table if circular FK is deferred. |
| `available_at` | `timestamptz null` | Set when object is usable. |
| `delete_requested_at` | `timestamptz null` | Storage cleanup requested. |
| `deleted_at` | `timestamptz null` | Storage object removed or tombstoned. |
| `created_at` | `timestamptz not null default now()` |  |
| `updated_at` | `timestamptz not null default now()` |  |

Constraints/indexes:

- unique `(bucket, object_key)`
- index `(project_id, asset_type, created_at desc)`
- index `(project_id, status)`
- partial unique one original source per project where `asset_type = 'original_source' and deleted_at is null`

### `processing_jobs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |  |
| `project_id` | `uuid not null references projects(id) on delete cascade` |  |
| `job_type` | `job_type not null` | source_validation, media_probe, proxy_generation, coarse_analysis, candidate_detection, deep_analysis, story_generation, script_generation, voice_generation, edit_planning, render, quality_control, asset_deletion. |
| `status` | `job_status not null default 'queued'` | queued/leased/running/succeeded/failed/cancelled/retry_scheduled. |
| `priority` | `integer not null default 0` | Higher value may run earlier. |
| `attempt_count` | `integer not null default 0` | Check >= 0. |
| `max_attempts` | `integer not null default 3` | Check >= 1. |
| `idempotency_key` | `text not null` | Stable dedupe key for safe retries/enqueue. |
| `parent_job_id` | `uuid null references processing_jobs(id) on delete set null` | Dependency/lineage. |
| `scheduled_at` | `timestamptz not null default now()` |  |
| `lease_owner` | `text null` | Worker instance id, never user supplied. |
| `lease_expires_at` | `timestamptz null` | Workers may reclaim expired leases. |
| `progress_percent` | `integer null` | Only when real measurable progress exists. Check 0-100. |
| `progress_stage` | `text null` | Semantic activity. |
| `current_activity` | `text null` | User-safe activity line. |
| `payload` | `jsonb not null default '{}'` | Validated worker input. No secrets. |
| `result` | `jsonb not null default '{}'` | Sanitized result summary. |
| `error_code` | `text null` | Stable support code. |
| `error_message` | `text null` | User-safe where exposed. |
| `error_details` | `jsonb not null default '{}'` | Support-only details; do not expose raw logs to browser. |
| `started_at` | `timestamptz null` |  |
| `completed_at` | `timestamptz null` |  |
| `created_at` | `timestamptz not null default now()` |  |
| `updated_at` | `timestamptz not null default now()` |  |

Constraints/indexes:

- unique `(project_id, job_type, idempotency_key)`
- index `(status, scheduled_at, priority desc)` for worker polling
- index `(project_id, created_at desc)`
- index `(lease_expires_at) where status in ('leased','running')`

### `analysis_runs`

Columns: `id`, `project_id`, `run_type text`, `status analysis_run_status`, `source_asset_id`, `proxy_asset_id`, `summary text`, `model_metadata jsonb`, `metrics jsonb`, `started_at`, `completed_at`, `created_at`, `updated_at`.

Constraints:

- `run_type` check: coarse/deep/combined.
- asset FKs `on delete restrict` to preserve reproducibility unless project deletion is underway.

Indexes: `(project_id, created_at desc)`, `(project_id, status)`.

### `gameplay_events`

Columns: `id`, `project_id`, `analysis_run_id`, `event_type text`, `start_ms integer`, `end_ms integer`, `confidence numeric`, `importance_score numeric`, `title text`, `summary text`, `actor_labels jsonb`, `evidence jsonb`, `created_at`, `updated_at`.

Constraints:

- FK `analysis_run_id references analysis_runs(id) on delete cascade`.
- `start_ms >= 0` and `end_ms > start_ms`.
- `confidence between 0 and 1`.
- `importance_score between 0 and 100`.

Indexes: `(project_id, start_ms)`, `(analysis_run_id, start_ms)`, `(project_id, event_type)`.

### `candidate_moments`

Columns: `id`, `project_id`, `analysis_run_id`, `moment_type text`, `start_ms`, `end_ms`, `confidence`, `importance_score`, `title`, `summary`, `selection_reason`, `inclusion_state text`, `excluded_by uuid null`, `excluded_at timestamptz null`, `exclusion_reason text null`, `created_at`, `updated_at`.

`inclusion_state` check: candidate/included/excluded/restored.

Indexes: `(project_id, start_ms)`, `(project_id, importance_score desc)`, `(analysis_run_id)`.

### `candidate_moment_events`

Columns: `candidate_moment_id`, `gameplay_event_id`, `relationship text not null default 'supports'`, `created_at`.

Primary key: `(candidate_moment_id, gameplay_event_id)`.

### `story_versions`

Columns: `id`, `project_id`, `version_number`, `status story_status`, `is_selected boolean default false`, `title`, `angle`, `summary`, `structure jsonb`, `generation_metadata jsonb`, `created_by_job_id`, `created_at`, `updated_at`.

Constraints/indexes:

- unique `(project_id, version_number)`
- unique partial `(project_id) where is_selected`
- index `(project_id, created_at desc)`

### `story_version_moments`

Columns: `story_version_id`, `candidate_moment_id`, `story_role text`, `sort_order integer`, `created_at`.

Primary key: `(story_version_id, candidate_moment_id, story_role)`.

### `script_versions`

Columns: `id`, `project_id`, `story_version_id`, `creative_settings_id`, `version_number`, `status script_status`, `language`, `character_id uuid null references characters(id) on delete set null`, `narrator_config jsonb`, `full_text text`, `generation_metadata jsonb`, `created_by_job_id`, `created_at`, `updated_at`.

`narrator_config` freezes the character's resolved voice + speech-style configuration at generation time (second freeze point, see `docs/CHANNEL_CHARACTER_MODEL.md`). Later character edits never change existing script versions.

Constraints/indexes: unique `(project_id, version_number)`, index `(story_version_id)`, index `(project_id, created_at desc)`.

### Required `generation_metadata` keys

Every generated version row (`story_versions`, `script_versions`, `narration_assets`, `edit_versions`) must record in its `generation_metadata`/equivalent jsonb: `model_id`, `model_version` (when reported by the provider), `prompt_template_version`, `character_config_hash`, and the sampling parameters used. Model ids are pinned via configuration, never provider "latest" aliases. This is what makes per-channel consistency auditable and regressions diagnosable.

### `script_sections`

Columns: `id`, `project_id`, `script_version_id`, `section_index integer`, `start_ms integer`, `end_ms integer`, `beat_label text`, `text text not null`, `status text not null default 'active'`, `parent_section_id uuid null`, `created_at`, `updated_at`.

Constraints:

- unique `(script_version_id, section_index)`
- `end_ms > start_ms`
- `status` check: active/superseded/regenerating/failed

### `narration_assets`

Columns: `id`, `project_id`, `script_section_id`, `asset_id`, `status text not null`, `duration_ms integer null`, `voice_provider text null`, `voice_config jsonb`, `generation_metadata jsonb`, `created_by_job_id`, `created_at`, `updated_at`.

Constraints:

- `asset_id references assets(id) on delete restrict`
- status check: pending/generating/available/failed/superseded
- unique partial `(script_section_id) where status = 'available'`

### `edit_versions`

Columns: `id`, `project_id`, `story_version_id`, `script_version_id`, `creative_settings_id`, `version_number`, `status edit_status`, `edl_schema_version integer not null default 1`, `timeline_duration_ms integer null`, `summary text`, `edl jsonb not null default '{}'`, `created_by_job_id`, `created_at`, `updated_at`.

Constraints/indexes: unique `(project_id, version_number)`, index `(project_id, created_at desc)`, check `edl_schema_version >= 1`.

### `edit_segments`

Columns: `id`, `project_id`, `edit_version_id`, `segment_index integer`, `segment_type text`, `output_start_ms`, `output_end_ms`, `source_asset_id uuid null`, `source_start_ms integer null`, `source_end_ms integer null`, `candidate_moment_id uuid null`, `script_section_id uuid null`, `included boolean not null default true`, `effect_summary text null`, `metadata jsonb not null default '{}'`, `created_at`, `updated_at`.

Constraints:

- unique `(edit_version_id, segment_index)`
- output range valid
- source range valid when source fields are present

### `output_versions`

Columns: `id`, `project_id`, `version_number`, `status output_version_status`, `story_version_id`, `script_version_id`, `edit_version_id`, `creative_settings_id`, `final_asset_id uuid null`, `qc_status qc_status not null default 'not_started'`, `is_current boolean not null default false`, `is_approved boolean not null default false`, `approved_by uuid null`, `approved_at timestamptz null`, `change_summary text null`, `created_at`, `updated_at`.

Constraints/indexes:

- unique `(project_id, version_number)`
- unique partial `(project_id) where is_current`
- unique partial `(project_id) where is_approved`
- `approved_at is not null` when `is_approved`

### `render_attempts`

Columns: `id`, `project_id`, `output_version_id`, `job_id`, `attempt_number integer`, `status render_status`, `edit_version_id`, `output_asset_id uuid null`, `intermediate_asset_id uuid null`, `technical_metadata jsonb`, `error_code text`, `error_message text`, `started_at`, `completed_at`, `created_at`, `updated_at`.

Constraints/indexes:

- unique `(output_version_id, attempt_number)`
- index `(project_id, created_at desc)`
- output/intermediate asset FKs `on delete restrict`

### `quality_checks`

Columns: `id`, `project_id`, `output_version_id`, `render_attempt_id uuid null`, `qc_type text not null`, `status qc_status not null`, `passed boolean null`, `blocking boolean not null default true`, `summary text null`, `checks jsonb not null default '{}'`, `created_by_job_id uuid null`, `created_at`, `updated_at`.

`qc_type` check: technical/creative/combined.

## Migration Strategy

- Pending migrations live under `supabase/migrations/`; successfully executed migrations are moved to `supabase/applied/`. See `supabase/README.md` for the manual workflow.
- Name migrations sequentially as `NNN_descriptive_name.sql`.
- Every schema change must be committed and reviewed; no manual production drift beyond executing the reviewed migration files.
- Migrations should be forward-only for production. Use explicit repair migrations rather than editing applied migrations.
- Include table comments and column comments for JSONB and security-sensitive fields.
- Create RLS policies in the same migration as each table or immediately after table creation.
- Generate TypeScript database types from Supabase after migrations are applied locally.

## Foreign Key Delete Behavior

- `profiles` cascades when `auth.users` is deleted.
- `projects.user_id` uses restrict; application-level account deletion should request project deletion first.
- Most project children cascade on project hard deletion, but hard deletion should only occur after storage cleanup and explicit operational approval.
- Asset references used for reproducibility should restrict deletion while referencing output/story/script/render records exist.
- Normal user project deletion should be soft deletion plus asynchronous asset cleanup, not immediate destructive cascade.

## Required Extensions

- `pgcrypto` for `gen_random_uuid()`.

Do not enable extra extensions unless a concrete migration requires them.
