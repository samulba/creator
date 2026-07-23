# Creator — Supabase Architecture

## Purpose

This document defines how Creator should use Supabase Auth, Supabase Postgres, migrations, generated types, RLS, and privileged server/worker access. It does not connect to a live Supabase project and does not create remote resources.

## Supabase Responsibilities

Supabase provides:

- user authentication through Supabase Auth
- Postgres storage for structured application data
- Row Level Security for per-user authorization boundaries
- generated TypeScript database types after migrations are created
- local development database workflow once introduced

Supabase does not store large video binaries. Cloudflare R2 stores original gameplay, proxies, generated audio, intermediates, and final renders.

## Environment Separation

Use separate Supabase projects for:

- local development
- preview/staging if needed
- production

Never manually edit production schema outside version-controlled migrations. Never use production data for local development unless it is explicitly sanitized.

## Key Management

### Browser

May receive only public Supabase URL and anon key. The anon key relies on RLS and is not a secret.

### Server/API

Uses user sessions for user-scoped operations. May use service-role credentials only in server-only modules for operations that require privileged writes, after explicit authorization checks.

### Worker

Uses service-role credentials or dedicated worker credentials stored only in worker environment secrets. Worker credentials must not be available to Next.js client components or browser bundles.

## Recommended Supabase Client Separation

When implemented later, keep separate clients:

1. Browser client: anon key, user session, RLS enforced.
2. Server user client: request cookies/session, RLS enforced as the user.
3. Admin/server client: service role, server-only, for controlled privileged operations.
4. Worker client: service role or worker role, worker-only.

Do not import admin clients from client-side modules.

## Authentication Flow

- Supabase Auth owns identity.
- `profiles` row should be created by a database trigger after user signup or by an idempotent server-side profile bootstrap.
- Application routes under `/app` should require authentication once auth is implemented.
- Server endpoints should derive the user from the Supabase session, not from request body fields.

## RLS Architecture

- Enable RLS on every public application table.
- Default posture: no public access.
- Authenticated users can select only rows belonging to their own projects.
- Browser writes are limited to safe profile fields and carefully designed user actions.
- Workflow mutations should be server/RPC mediated so state transitions remain valid.

## Database Access Patterns

### Dashboard

Query `projects` by `user_id`, excluding `deleted_at` rows, sorting by active/urgent status and `updated_at`.

Include aggregate fields from project row and safe child summaries rather than job internals.

### Project workspace

Load project by id through RLS, then load related child tables by `project_id`. Use typed APIs/views for sanitized job and asset data.

### Review output

Server endpoint verifies project ownership, finds current or approved final asset, and returns a short-lived signed R2 URL.

### Upload

1. Client requests upload creation from server.
2. Server validates authenticated user and project ownership.
3. Server creates pending `assets` row with server-generated object key.
4. Server returns signed upload URL or multipart upload instructions.
5. Client uploads directly to R2.
6. Client notifies server upload is complete.
7. Server verifies R2 object metadata and updates asset status.
8. Server enqueues source validation/media probe jobs.

## Background Job Architecture on Supabase

Supabase Postgres can store job state but should not execute heavy video work. Dedicated workers poll/claim jobs and perform processing externally.

Use database transactions and `for update skip locked` in privileged RPCs for atomic job claiming. Use leases so interrupted workers do not permanently strand jobs.

Do not expose queue internals to normal users. The UI reads project semantic state and sanitized job summaries.

## Type Safety

- Migrations define the schema.
- Supabase generated TypeScript types should be regenerated after schema changes.
- Application validation schemas should mirror JSONB payload shapes, AI outputs, and API request bodies.
- Do not rely on `any` for database payloads in TypeScript implementation.

## Migration Workflow

1. Create or update SQL migration locally.
2. Run local Supabase reset/migration apply.
3. Regenerate database TypeScript types.
4. Run lint/typecheck/tests/build.
5. Review RLS policies with positive and negative tests.
6. Apply through controlled deployment, never by manual production editing.

Migration naming: `YYYYMMDDHHMMSS_descriptive_name.sql`.

## Backups and Recovery

For production readiness:

- enable Supabase managed backups appropriate to the production plan
- test restoration before relying on production data
- avoid destructive migrations without explicit backup/rollback planning
- use soft deletion for user project deletes so R2 cleanup and DB state can be reconciled

## Data Lifecycle with R2

Project deletion is asynchronous:

1. User requests delete.
2. Server sets `delete_requested_at` and `pipeline_state = 'deleting'`.
3. Pending/running jobs are cancelled where safe.
4. Asset deletion jobs remove or tombstone R2 objects.
5. Asset rows move to `deleted` status with `deleted_at`.
6. Project receives `deleted_at` after cleanup completes.
7. Hard DB deletion is optional operational cleanup, not the user-facing delete action.

This avoids accidental orphaned storage and avoids destructive cascades before external objects are cleaned up.

## Storage Bucket Recommendation

Use private R2 buckets or key prefixes by environment. Suggested object key pattern:

```text
{environment}/users/{user_id}/projects/{project_id}/assets/{asset_id}/{safe_generated_name}
```

The key is generated server-side. The original filename may be stored for display but must not drive the storage path without sanitization.

## Security Checklist

- RLS enabled on all application tables.
- Service role isolated to server/worker environments.
- R2 private by default.
- Signed URLs generated server-side and short-lived.
- Upload completion verified server-side.
- AI outputs schema-validated before insertion.
- Job payloads schema-validated before execution.
- No provider credentials, signed URLs, or secrets stored in browser-accessible data.

## What Supabase Should Not Do in MVP

- Store video blobs in Postgres.
- Run FFmpeg or long AI tasks in database functions.
- Act as a public file host for private media.
- Implement organizations, billing, teams, or social publishing.
