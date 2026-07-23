# Supabase — Manual Migration Workflow

Creator manages the Supabase schema with plain SQL files that are applied **manually** through the Supabase SQL Editor. There is no automated remote migration tooling in this repository, and no database credentials are stored here.

## Folder model

```text
supabase/
  migrations/   ← PENDING: not yet executed against the Supabase project
  applied/      ← DONE: manually executed successfully in the SQL Editor
  README.md
```

- `supabase/migrations/` contains migrations that have **not** been applied yet.
- `supabase/applied/` contains migrations that **have** been executed successfully.
- A migration lives in exactly one of the two folders. Moving the file **is** the bookkeeping.

## Workflow

1. A new migration is created as a numbered SQL file in `supabase/migrations/`.
2. You open the Supabase Dashboard → SQL Editor for the target project.
3. You copy the full contents of the migration file and execute it.
4. **Only after it executed successfully**, move the file to `supabase/applied/` (keep the same filename) and commit the move.
5. If execution failed, fix the migration in `supabase/migrations/` and re-run. Nothing is moved until it succeeds.

## Naming convention

Sequential, zero-padded, snake_case:

```text
001_supabase_foundation.sql
002_<short_description>.sql
003_<short_description>.sql
```

Numbers define execution order. Never reuse a number. Apply migrations strictly in order.

## Rules

- **Never** move a migration to `applied/` before it executed successfully.
- **Never** edit a migration in `applied/` to change the production schema. Applied files are a historical record.
- Schema changes after a migration is applied require a **new** migration file with the next number.
- Editing a still-pending migration in `migrations/` is fine — it has not touched any database yet.
- Migrations should be forward-only. Prefer explicit repair migrations over rollbacks.
- Never commit Supabase credentials (database password, service-role key, secret keys) to this repository.

## Current state

| Migration                                    | Status                                                         |
| -------------------------------------------- | -------------------------------------------------------------- |
| `applied/001_supabase_foundation.sql`        | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/002_channels_and_characters.sql`    | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/003_assets.sql`                     | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/004_processing_jobs.sql`            | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/005_grant_authenticated_access.sql` | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/006_grant_service_role_access.sql`  | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/007_analysis_foundation.sql`        | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/008_story_and_script.sql`           | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/009_narration_assets.sql`           | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/010_edit_engine.sql`                | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/011_render_engine.sql`              | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/012_project_deletion_rpc.sql`       | **Applied** — executed successfully in the Supabase SQL Editor |
| `applied/013_pipeline_reliability.sql`       | **Applied** — executed successfully in the Supabase SQL Editor |

`001_supabase_foundation.sql` created the `profiles`, `projects`, and `project_creative_settings` tables, the `project_pipeline_state` enum, `updated_at` triggers, the automatic profile-creation trigger on `auth.users`, and enabled RLS with owner-scoped policies on all three tables.

`002_channels_and_characters.sql` added the `characters` (reusable narrator identities: voice + speech style) and `channels` (YouTube channel defaults + edit style) tables with owner-scoped RLS, plus `projects.channel_id`, `project_creative_settings.character_id` / `edit_style`, and `profiles.default_character_id`.

`003_assets.sql` added the `asset_type`/`asset_status` enums and the `assets` table (private R2 object metadata: original gameplay sources now, generated media later) with owner-scoped read-only RLS, one-active-original-per-project enforcement, and `projects.source_asset_id`.

`004_processing_jobs.sql` added the Postgres job queue: `job_type`/`job_status` enums, the `processing_jobs` table (users have no direct access), the sanitized `public_user_jobs` view, user RPCs `enqueue_job`/`retry_job`, worker RPCs `claim_next_job`/`start_job`/`heartbeat_job`/`complete_job`/`fail_job` (service_role only), and `assets.created_by_job_id`.

`005_grant_authenticated_access.sql` grants the `authenticated` role explicit privileges on the user-facing tables, the `public_user_jobs` view, and the user job RPCs. Supabase usually sets these via default privileges, but that did not apply to the migration-created tables in this project, which blocked the app from reading channels/characters/assets even though the tables and RLS policies exist. RLS remains the real gate; `processing_jobs` and the worker RPCs stay service_role-only.

`006_grant_service_role_access.sql` grants the `service_role` full access to the public schema (current and future tables), matching Supabase's intended backend-role setup. The video worker connects with the service_role key and does direct table reads/writes; without this it would hit the same missing-default-privilege gap as 005 and fail with "permission denied". **Apply this before deploying the worker.**

`007_analysis_foundation.sql` adds the `analysis_run_status` enum and the `analysis_runs`, `gameplay_events`, `candidate_moments`, and `candidate_moment_events` tables — the data model the AI analysis writes into (Phase 5). Owner-scoped read-only RLS for `authenticated`; writes come from the worker (service_role) or later server RPCs.

`008_story_and_script.sql` adds the `story_status`/`script_status` enums and the `story_versions`, `story_version_moments`, `script_versions`, and `script_sections` tables (Phase 6 story engine), plus `projects.selected_story_version_id` (composite FK, so the selected story must belong to the project). `script_versions.narrator_config` freezes the resolved character config at generation time (second consistency freeze point). Owner-scoped read-only RLS; worker writes via service_role.

`009_narration_assets.sql` adds the `narration_assets` table (Phase 7 voice engine): voice-specific metadata linking a `script_section` to its `narration_audio` asset, with `voice_config`/`generation_metadata` frozen per narration (pinned model id, provider request id). A composite FK ties the audio asset to the same project, and a partial unique index enforces one available narration per section. Owner-scoped read-only RLS; worker writes via service_role.

`010_edit_engine.sql` adds the `edit_status` enum and the `edit_versions` (inspectable Edit Decision List: jsonb EDL + summary) and `edit_segments` (normalized, one row per output segment with its source range) tables (Phase 8). The EDL is deterministic — no AI provider — and a composite FK ties each segment's source clip to the same project. Owner-scoped read-only RLS; worker writes via service_role.

`011_render_engine.sql` adds the `output_version_status`, `render_status`, and `qc_status` enums and the `output_versions` (a produced story+script+edit combination; partial uniques for one current + one approved per project) and `render_attempts` (each FFmpeg run, with technical metadata) tables (Phase 9). Composite FKs tie the final/output/intermediate assets to the same project. The `qc_status` enum is reused by Phase 10. Owner-scoped read-only RLS; worker writes via service_role.

`013_pipeline_reliability.sql` adds `projects.pre_archive_state` (so un-archiving restores the pipeline state instead of resetting to draft) and rebuilds `claim_next_job` with a reaper that settles jobs whose lease expired with no attempts left as failed (previously they were stuck in `running` forever and the project froze mid-stage).

`012_project_deletion_rpc.sql` adds the `request_project_deletion(uuid)` SECURITY DEFINER function so a user can soft-delete their own project. A plain `UPDATE` that sets `deleted_at` is rejected by RLS — Postgres applies the `deleted_at is null` SELECT policy as a check on the produced row — so the delete goes through this function, which enforces ownership itself (`user_id = auth.uid()`). Granted to `authenticated`.

## After applying a migration

- Update `src/lib/supabase/database.types.ts` so TypeScript types match the schema. `npm run db:types` can generate them via the Supabase CLI (`SUPABASE_PROJECT_ID=<ref> npm run db:types`), or the file can be maintained by hand while the schema is small.
- Run `npm run lint`, `npm run typecheck`, and `npm run build`.
