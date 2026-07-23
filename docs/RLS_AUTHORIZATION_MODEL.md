# Creator — RLS and Authorization Model

## Purpose

This document defines how Creator uses Supabase Auth, Postgres Row Level Security, server-side authorization, and worker privileges. Database-level authorization is mandatory and must not be replaced by hidden UI or application-only checks.

## Actors

### Browser client

Authenticated end user using Supabase session cookies/tokens. Browser clients are untrusted for ownership, storage paths, job state transitions, and privileged workflow operations.

Allowed in MVP:

- read own profile
- update safe profile preferences
- read own projects and child data
- create a project only through server-side API or guarded RPC that derives `user_id = auth.uid()`
- request allowed user actions such as archive/delete/cancel/retry through server-side APIs

Not allowed:

- set arbitrary `user_id`
- create or mutate processing jobs directly
- lease jobs
- write worker results
- write asset availability for generated assets
- generate signed R2 URLs directly
- access another user's rows

### Next.js server/API

Uses the user's Supabase session for user-scoped operations, plus narrowly controlled server credentials only where necessary. Server endpoints validate request bodies and derive ownership from the authenticated session.

Responsibilities:

- project creation/update/archive/delete requests
- upload initiation and completion verification
- signed upload/download URL creation after authorization checks
- enqueue jobs through secure server-only logic
- expose sanitized job/project status to the UI

### Background worker

Privileged service operating outside the browser. Workers may use Supabase service role or a dedicated least-privilege database role/RPC pattern. Service-role credentials must never be exposed to browser bundles or logs.

Responsibilities:

- claim/lease jobs
- update job status/progress/results
- create generated assets
- write analysis/story/script/edit/render/QC rows
- transition project pipeline states according to validated workflow rules
- request R2 object reads/writes using server-held credentials

### Supabase service role

Bypasses RLS. It is only for trusted server/worker environments. Code using it must perform explicit authorization checks before acting on behalf of a user.

## RLS Policy Pattern

Enable RLS on every application table.

### Ownership predicate

For tables with `user_id`:

```sql
user_id = auth.uid()
```

For project child tables:

```sql
exists (
  select 1
  from projects p
  where p.id = <table>.project_id
    and p.user_id = auth.uid()
    and p.deleted_at is null
)
```

Use this predicate for `select` policies unless deleted/tombstoned rows must remain hidden.

## Table Policy Specification

### `profiles`

- `select`: authenticated users can select only `id = auth.uid()`.
- `insert`: preferably server-side trigger creates profile after signup. If client insert is allowed, require `id = auth.uid()`.
- `update`: authenticated users can update only safe profile fields for `id = auth.uid()`.
- `delete`: no direct browser delete. Account deletion must be server-side.

### `projects`

- `select`: owner can select own non-deleted projects.
- `insert`: only server-side API or RPC. If direct insert is enabled, `with check (user_id = auth.uid())`, and disallow client-supplied privileged fields through column privileges or RPC.
- `update`: owner can update safe user-editable fields such as title/description/archive request. Do not allow direct client updates to `pipeline_state`, failure fields, selected output pointers, or deletion completion.
- `delete`: no direct browser hard delete. Use soft-delete request through server API.

Recommended implementation: revoke direct table update for sensitive columns from `authenticated` and expose RPCs for stateful actions.

### `characters`

- `select` / `insert` / `update` / `delete`: owner-scoped (`user_id = auth.uid()` in `using` and `with check`).
- Lifecycle is archive-first. The server refuses hard deletion while the character is referenced by an active project's active settings row; the database additionally nulls references on delete (`on delete set null`).

### `channels`

- `select` / `insert` / `update` / `delete`: owner-scoped, same pattern as `characters`.
- `default_character_id` cannot reference another user's character: enforced at the database level with a composite FK `(default_character_id, user_id) references characters(id, user_id)` — RLS cannot validate referenced rows and service-role code bypasses RLS. The same pattern protects `projects.channel_id` and `profiles.default_character_id`.

### `project_creative_settings`

- `select`: owner can read settings for own project.
- `insert`: owner can create settings only for own project through server/RPC, deriving project ownership and validating enum values. The `with check` additionally requires `character_id` (when set) to reference a character owned by the same user.
- `update`: direct updates should be avoided; create a new version instead. Workers/server may toggle `is_active`.
- `delete`: no direct browser delete.

### `assets`

- `select`: owner can read metadata for assets belonging to own projects.
- `insert`: browser should not insert arbitrary assets. Upload initiation server endpoint creates pending original-source asset rows.
- `update`: browser cannot mark assets available/deleted. Upload completion endpoint verifies storage object then updates metadata server-side.
- `delete`: no direct browser hard delete.

Important: RLS on `assets` does not authorize R2 access by itself. R2 access must go through server-side signed URL generation after checking the asset's project ownership.

### `processing_jobs`

Implemented in migration 004:

- No direct access for `authenticated`/`anon` at all (grants revoked, RLS enabled with no policies).
- Owners read sanitized job state through the `public_user_jobs` view (owner-filtered via `auth.uid()`; excludes `payload`, `result`, `error_details`, priority, idempotency keys, and lease internals).
- User writes happen only through security-definer RPCs with internal ownership checks: `enqueue_job` (whitelisted job types only) and `retry_job`.
- Worker RPCs (`claim_next_job`, `start_job`, `heartbeat_job`, `complete_job`, `fail_job`) are executable by `service_role` only.

### Generated data tables

Applies to:

- `analysis_runs`
- `gameplay_events`
- `candidate_moments`
- `candidate_moment_events`
- `story_versions`
- `story_version_moments`
- `script_versions`
- `script_sections`
- `narration_assets`
- `edit_versions`
- `edit_segments`
- `output_versions`
- `render_attempts`
- `quality_checks`

Policies:

- `select`: owner can select rows belonging to own projects.
- `insert/update/delete`: no direct browser writes by default.
- User-intended changes, such as excluding a moment or editing a script section, should use server-side endpoints/RPCs that validate state, create new versions or safe mutations, and enqueue required jobs.

## Client-side, Server-side, Worker-side Operations

### Client-side

- Authenticate via Supabase Auth.
- Display project/dashboard data authorized by RLS.
- Request uploads, downloads, retries, cancellations, archives, deletes, and creative changes from server endpoints.
- Never send trusted `user_id`, storage bucket/key, worker id, or job status transitions.

### Server-side

- Validate session and authorization.
- Derive user id from Supabase session.
- Create projects and profile-safe settings.
- Generate R2 signed URLs.
- Validate upload completion and create source-validation jobs.
- Enqueue jobs with idempotency keys.
- Perform user-requested workflow mutations under transaction.

### Worker-side

- Claim jobs atomically using service role or security-definer RPC.
- Validate job payload schema before execution.
- Read/write private R2 objects.
- Store structured results.
- Advance project state transactionally.
- Fail safely with user-safe errors and support details separated.

## Worker Authorization and Leasing

Recommended worker claim flow:

1. Worker calls a privileged RPC such as `claim_next_job(worker_id, supported_job_types)`.
2. RPC selects an eligible queued/retry job with `for update skip locked`.
3. RPC sets `status = 'leased'`, `lease_owner`, `lease_expires_at`, increments no attempt yet or increments when execution starts.
4. Worker updates to `running` when execution starts.
5. Worker periodically extends lease for long jobs.
6. If lease expires, another worker may reclaim the job if the job type is retry-safe and attempt limit allows.
7. Worker completes/fails job through privileged RPCs that validate current lease ownership.

Do not expose worker RPCs to browser clients.

## Signed Asset Access

- R2 buckets are private by default.
- Browser access uses short-lived signed URLs generated server-side.
- Signed URLs should be scoped to one object, one purpose, and the shortest practical expiration.
- Upload URLs should be created only for pending assets owned by the authenticated user.
- Download/preview URLs should be created only for available assets owned by the authenticated user.
- Do not store complete signed URLs in Postgres or logs.

## Security Constraints

- Never expose service role keys to the browser.
- Never trust browser-provided ownership fields.
- Treat user uploads, filenames, and AI provider output as untrusted.
- Validate all structured AI output before insertion.
- Keep provider request/response details out of user-facing tables unless sanitized.
- Use database constraints to enforce important invariants such as valid states, one active settings row, one approved output version, and valid time ranges.

## Minimal Observability

MVP does not need an enterprise audit log, but key rows should preserve:

- creator/updater where user-facing decisions are made
- timestamps for each lifecycle transition
- job attempts and failure codes
- output approval actor and timestamp
- soft-delete request and completion timestamps

If a durable user-facing activity feed becomes necessary, add `project_activity_events` near-term rather than overloading job logs.
