# Creator

Creator is a professional AI-powered web application for turning raw Dead by Daylight gameplay into high-quality long-form YouTube videos. Built by Framepath.

## Current state

- **Landing page** (`/`) — public marketing page.
- **Authentication** (`/login`, `/signup`, `/auth/callback`, `/auth/signout`) — Supabase Auth with protected routes.
- **Application** (`/app`) — protected workspace **prototype** running on local demo data (see `components/app/demo-data.ts`). No uploads, processing, or rendering are connected yet.
- **Database** — the foundation migration exists but is still pending; see `supabase/README.md`.

## Structure

```text
app/            Next.js App Router routes
components/
  ui/           shared design-system primitives (Button, Field, StatusBadge, …)
  auth/         auth screens and form
  app/          workspace prototype (demo data)
src/
  env.ts        NODE_ENV validation
  lib/auth/     session helper, redirect safety, friendly errors
  lib/supabase/ config + browser/server clients + database types
supabase/
  migrations/   pending SQL migrations (not yet executed)
  applied/      migrations already executed in the Supabase SQL Editor
docs/           product, architecture, and design documentation
proxy.ts        session refresh + route protection
```

Design tokens live in `app/globals.css`; the design direction is documented in `docs/APP_DESIGN_SYSTEM.md`.

## Environment

Copy `.env.example` to `.env.local` and fill in the values from your Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

Builds succeed without these values; auth-dependent pages show a configuration notice instead.

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
