# Creator

Creator is a professional AI-powered web application for turning raw Dead by Daylight gameplay into high-quality long-form YouTube videos. Built by Framepath.

## Current state

- **Landing page** (`/`) — public marketing page.
- **Authentication** (`/login`, `/signup`, `/auth/callback`, `/auth/signout`) — Supabase Auth with protected routes.
- **Application** (`/app`) — protected workspace with real Supabase-backed projects, channel-first creation, and direct-to-R2 gameplay uploads. `/app/settings` manages channels and narrator characters (see `docs/CHANNEL_CHARACTER_MODEL.md`). The end-to-end pipeline experience is visible as a clearly labeled demo under "Product preview".
- **Storage** — private Cloudflare R2 bucket; browser uploads go directly to R2 via server-signed multipart URLs (`src/lib/storage/`, `src/lib/actions/uploads.ts`).
- **Job system** — Postgres-based queue (`supabase/applied/004_processing_jobs.sql`); uploads enqueue `source_validation`, the workspace shows semantic pipeline progress.
- **Video worker** — a standalone Docker service in `worker/` that claims jobs and runs FFprobe/FFmpeg (source validation, media probe, proxy generation) plus the first AI step, Gemini **coarse analysis** (schema-validated gameplay events + candidate moments). Deploys outside Vercel; see `worker/README.md`.
- **AI analysis (Phase 5)** — `coarse_analysis` sends the analysis proxy to Gemini and records grounded, schema-validated events and candidate moments into `analysis_runs` / `gameplay_events` / `candidate_moments` (migration 007). It runs only when the worker has a `GEMINI_API_KEY`; without one the pipeline pauses at _Understanding gameplay_ instead of failing. The provider boundary lives in `worker/src/ai/`.
- **Database** — migrations 001–005 applied; 006 (service_role grants) and 007 (analysis foundation) pending. See `supabase/README.md`.
- **Not built yet** — story, ElevenLabs voice, edit, render, QC: Phases 6–10.

## Structure

```text
app/            Next.js App Router routes
components/
  ui/           shared design-system primitives (Button, Field, StatusBadge, …)
  auth/         auth screens and form
  app/          workspace prototype (demo data)
src/
  env.ts        NODE_ENV validation
  lib/actions/  server actions (projects, channels, characters, uploads)
  lib/auth/     session helper, redirect safety, friendly errors
  lib/storage/  Cloudflare R2 (server-only config, presigned URLs)
  lib/supabase/ config + browser/server clients + database types
supabase/
  migrations/   pending SQL migrations (not yet executed)
  applied/      migrations already executed in the Supabase SQL Editor
worker/         standalone video worker (Docker, FFmpeg) — deploy off-Vercel
docs/           product, architecture, and design documentation
proxy.ts        session refresh + route protection
```

Design tokens live in `app/globals.css`; the design direction is documented in `docs/APP_DESIGN_SYSTEM.md`.

## Environment

Copy `.env.example` to `.env.local` and fill in the values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (server-only; uploads) — the private bucket needs a CORS rule for the app origin with `ExposeHeaders: ETag`

Builds succeed without these values; the affected surfaces show a configuration notice instead.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run typecheck
npm run build
npm run format
```
