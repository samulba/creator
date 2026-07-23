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

`001_supabase_foundation.sql` created the `profiles`, `projects`, and `project_creative_settings` tables, the `project_pipeline_state` enum, `updated_at` triggers, the automatic profile-creation trigger on `auth.users`, and enabled RLS with owner-scoped policies on all three tables.

`002_channels_and_characters.sql` added the `characters` (reusable narrator identities: voice + speech style) and `channels` (YouTube channel defaults + edit style) tables with owner-scoped RLS, plus `projects.channel_id`, `project_creative_settings.character_id` / `edit_style`, and `profiles.default_character_id`.

`003_assets.sql` added the `asset_type`/`asset_status` enums and the `assets` table (private R2 object metadata: original gameplay sources now, generated media later) with owner-scoped read-only RLS, one-active-original-per-project enforcement, and `projects.source_asset_id`.

`004_processing_jobs.sql` added the Postgres job queue: `job_type`/`job_status` enums, the `processing_jobs` table (users have no direct access), the sanitized `public_user_jobs` view, user RPCs `enqueue_job`/`retry_job`, worker RPCs `claim_next_job`/`start_job`/`heartbeat_job`/`complete_job`/`fail_job` (service_role only), and `assets.created_by_job_id`.

`005_grant_authenticated_access.sql` grants the `authenticated` role explicit privileges on the user-facing tables, the `public_user_jobs` view, and the user job RPCs. Supabase usually sets these via default privileges, but that did not apply to the migration-created tables in this project, which blocked the app from reading channels/characters/assets even though the tables and RLS policies exist. RLS remains the real gate; `processing_jobs` and the worker RPCs stay service_role-only.

## After applying a migration

- Update `src/lib/supabase/database.types.ts` so TypeScript types match the schema. `npm run db:types` can generate them via the Supabase CLI (`SUPABASE_PROJECT_ID=<ref> npm run db:types`), or the file can be maintained by hand while the schema is small.
- Run `npm run lint`, `npm run typecheck`, and `npm run build`.
