# Creator — Implementation Plan

## Goal

Creator must be built incrementally.

Each phase should be completed, tested, reviewed, and stabilized before the next major phase begins.

Do not attempt to build the entire product at once.

---

# Phase 0 — Foundation

## 0.1 Repository Foundation

* repository documentation
* AGENTS.md
* architecture rules
* security rules
* implementation plan

Status: **Done.**

---

## 0.2 Application Foundation

Build the initial web application foundation.

Scope:

* Next.js
* React
* TypeScript
* App Router
* Tailwind CSS
* strict TypeScript configuration
* linting
* formatting
* environment validation structure
* basic health endpoint
* initial CI validation

Do not yet add:

* Supabase
* authentication
* Cloudflare R2
* AI providers
* video processing
* worker infrastructure

Status: **Done.**

---

# Phase 1 — Web Application Core

Status: **Phase 1 is done** — 1.1 (shell + design system), 1.2 (Supabase foundation, migration 001), 1.3 (authentication), 1.4 (real project model), and 1.5 (channels & characters, migration 002).

## 1.1 Application Shell

Build:

* base layout
* navigation structure
* dashboard shell
* reusable UI foundation
* error boundaries
* loading states

No fake production functionality.

---

## 1.2 Supabase Foundation

Add:

* Supabase project integration
* database client architecture
* server/client separation
* migration workflow
* environment configuration

---

## 1.3 Authentication

Add:

* Supabase Auth
* login
* logout
* protected application routes
* secure session handling

---

## 1.4 Project Model

Create the initial project system.

A project represents one video production workflow.

Initial capabilities:

* create project (channel-first, snapshotting channel defaults into settings)
* view project
* list projects
* basic project status
* delete or archive project where appropriate

---

## 1.5 Channels & Characters

Make per-channel consistency structural (see `docs/CHANNEL_CHARACTER_MODEL.md`):

* migration 002: `characters` + `channels` tables, `projects.channel_id`, settings `character_id`/`edit_style`
* Settings UI: manage channels and characters (archive-first)
* New Video flow: channel-first selection, defaults shown not re-asked
* profile default character

---

# Phase 2 — Storage and Uploads

Status: 2.1 and 2.2 are **done** (migration 003, server-only R2 abstraction, direct multipart browser uploads with real progress and per-part retries). 2.3 is partially done: upload completion is verified server-side (HEAD + size check) and asset state is tracked; media probing and validation **job creation** are deliberately deferred to Phases 3/4 where the job system and worker exist.

## 2.1 Cloudflare R2 Foundation

Add:

* private object storage
* secure credentials (`R2_*` env vars, server-only in `src/lib/storage/`)
* storage abstraction
* asset metadata model (`assets` table, migration 003)

---

## 2.2 Large Video Upload

Implement:

* direct browser-to-storage upload (presigned multipart part URLs)
* upload progress (real transfer progress)
* failure recovery (per-part retries, abort frees the source slot)
* large-file support (up to 32 GB, 32 MiB parts)
* multipart upload architecture
* secure project ownership validation (server actions + RLS)

Do not route large video files through normal Vercel request handlers.

Operational requirement: the private R2 bucket needs a CORS rule for the app origin (methods PUT/GET, ExposeHeaders ETag) — see `.env.example`.

---

## 2.3 Source Asset Validation

Add:

* upload completion validation (done: server-side HEAD + size verification)
* file metadata (done: size/content type; media probe data comes from the Phase 4 worker)
* source asset state (done)
* validation job creation (deferred to Phase 3 — requires the job system)

---

# Phase 3 — Job System

Decision: the job queue is Postgres-based (`processing_jobs` table, atomic claims via `for update skip locked` in privileged RPCs, leases for crash recovery). No external queue technology unless Postgres proves insufficient.

Status: **Done** (migration 004). Users have no direct table access — sanitized state flows through the `public_user_jobs` view; `enqueue_job`/`retry_job` are the user RPCs, and workers (Phase 4) use `claim_next_job`/`start_job`/`heartbeat_job`/`complete_job`/`fail_job` (service_role only). Upload completion enqueues `source_validation` and moves the project to `preparing`; the workspace shows semantic stage progress with owner retry for terminal failures. Retryable failures back off exponentially (30s·2^attempt, capped at 15 min).

## 3.1 Background Job Model

Create a reliable job system for long-running tasks.

Support:

* queued
* processing
* completed
* failed
* cancelled

Jobs must have:

* explicit ownership
* retry behavior where safe
* error information
* timestamps
* progress where appropriate

---

## 3.2 Queue Infrastructure

Introduce the selected queue technology.

Do not tightly couple product logic to one queue provider.

---

# Phase 4 — Video Worker

Status: 4.1, 4.2, and 4.3 are **done**. The worker lives in `worker/` as a
self-contained Docker service (excluded from the web app's tooling). It polls
the queue via `claim_next_job`, runs FFprobe over presigned URLs, generates a
downscaled proxy with FFmpeg, and advances the pipeline through the
*Preparing footage* stage into *Understanding gameplay*. Job chain:
`source_validation → media_probe → proxy_generation → coarse_analysis`
(`coarse_analysis` is handled from Phase 5). FFprobe/FFmpeg parsing and proxy
transcoding are verified locally against generated media; deployment +
service-role/R2 secrets are documented in `worker/README.md` and set up by
the operator. No new migration was required — migrations 003/004 already
cover the assets and jobs schema.

## 4.1 Worker Foundation

Create a separate containerized worker.

Include:

* Docker
* FFmpeg
* FFprobe
* job execution
* structured logging
* graceful failure handling (lease renewal via heartbeat; SIGTERM-aware loop)

A background worker has no inbound HTTP surface, so there is no health
endpoint; liveness is observed through job throughput and the container
host's process supervision.

---

## 4.2 Media Probe

Implement FFprobe-based source analysis.

Store:

* duration
* resolution
* frame rate
* codecs
* audio information
* file size
* relevant technical metadata

---

## 4.3 Proxy Generation

Generate analysis-friendly proxy assets.

Requirements:

* preserve original source
* configurable output
* safe temporary storage
* upload generated assets to object storage
* explicit job status

---

# Phase 5 — AI Video Intelligence

Status: 5.1, 5.2, and 5.3 are **done** as the `coarse_analysis` worker job;
5.4 (deep analysis) is scoped but not implemented. Data model:
`supabase/migrations/007_analysis_foundation.sql` (analysis_runs,
gameplay_events, candidate_moments, candidate_moment_events). Provider code:
`worker/src/ai/` behind an `AnalysisProvider` interface; the job handler is
`worker/src/jobs/coarse-analysis.ts`.

Honest boundary: the schema validation, persona/prompt assembly, config
hashing, and DB mapping are unit-tested (`worker/src/ai/schema.test.ts`, run
with `npm test` in `worker/`). The live Gemini HTTP calls require a real,
funded `GEMINI_API_KEY` and could not be end-to-end tested from the build
environment — they are written to Google's documented REST contract, and the
first run against a real key is the true integration test. Without the key the
worker does not claim `coarse_analysis` jobs, so the pipeline pauses at
*Understanding gameplay* rather than failing. Migrations 006 + 007 must be
applied before a worker with a key runs.

## 5.1 AI Provider Abstraction — done

`worker/src/ai/types.ts` defines the `AnalysisProvider` interface;
`worker/src/ai/index.ts` is a factory returning `null` when no provider is
configured. Provider-specific code (Gemini) stays behind the boundary in
`worker/src/ai/gemini.ts`, so another model/vendor can be added without
touching the handler.

## 5.2 Gemini Video Analysis — done

`coarse_analysis` uploads the analysis proxy to the Gemini File API and calls
`generateContent` with a strict `responseSchema` (structured output). Detects
match context, gameplay events (typed, ms-timestamped, confidence +
importance), and candidate moments. Every field is re-validated and clamped to
the DB constraints in `worker/src/ai/schema.ts` — provider output is data, not
instructions. The prompt is grounded (report only what is on screen; never
fabricate); the character persona + creative dials bias selection and framing,
not the facts. Each run stamps model id, prompt template version, and the
`character_config_hash` for per-channel consistency provenance.

## 5.3 Candidate Moment Detection — done (in the coarse pass)

The coarse pass produces `candidate_moments` directly, each citing the
`gameplay_events` that support it (via `candidate_moment_events`). Moments
carry an importance score and a selection reason and default to the
`candidate` inclusion state; users can later exclude/restore them.

## 5.4 Deep Analysis — scoped, not implemented

After a coarse pass the worker enqueues `deep_analysis` (currently unhandled →
stays queued). It will perform a more detailed pass over the strongest
candidates and produce structured event data suitable for story generation.

---

# Phase 6 — Story Engine

## 6.1 Story Director

Determine the strongest narrative angle grounded in actual gameplay.

---

## 6.2 Narrative Structure

Create:

* hook
* setup
* escalation
* turning points
* climax
* payoff

---

## 6.3 Script Generation

Generate timestamp-aware narration.

The script must:

* remain grounded in gameplay
* avoid redundant narration
* preserve strong gameplay moments
* support humor and pacing

Channel consistency requirements:

* prompt assembly consumes the character's `speech_style` as persona constraints; `example_lines` are the primary style anchor
* `forbidden_words` are enforced; catchphrases follow a frequency budget
* prompt templates are versioned in code; every generation records `model_id`, `prompt_template_version`, `character_config_hash`, and sampling parameters in `generation_metadata`
* the resolved character config is frozen into `script_versions.narrator_config`

---

# Phase 7 — Voice Engine

## 7.1 ElevenLabs Integration

Add:

* secure API integration
* narrator voice from the project's character (`voice_key` + `voice_settings`, ElevenLabs model pinned per character — never a "latest" alias)
* generated audio asset storage
* metadata (voice config frozen per narration asset; provider request ids stored)
* error handling (missing/deleted provider voice is a first-class failure code)

---

## 7.2 Voice Direction

Support structured narration instructions such as:

* pace
* emphasis
* pauses
* emotional delivery

Only where supported reliably.

---

# Phase 8 — Edit Engine

## 8.1 Edit Decision List

Create a structured, inspectable edit plan.

Support:

* source ranges
* cuts
* voiceover placement
* game audio levels
* zoom instructions
* freeze frames
* captions
* optional effects

Channel consistency requirement: edit planning reads the settings snapshot's `edit_style`; the EDL uses enumerated caption/zoom/transition style tokens, not freeform strings.

---

## 8.2 Timeline Builder

Convert the Edit Decision List into a deterministic render timeline.

Creative decisions must remain separate from low-level rendering code.

---

# Phase 9 — Render Engine

## 9.1 Automated Video Rendering

Use the dedicated worker and FFmpeg to create the final video.

Initial capabilities:

* cuts
* source sequencing
* voiceover
* gameplay audio
* audio ducking
* basic zooms
* basic captions
* final encoding

---

## 9.2 Render Validation

Validate:

* readable output
* video stream
* audio stream
* duration
* synchronization
* render completion

---

# Phase 10 — Quality Control

## 10.1 Technical QC

Automatically detect obvious technical failures.

---

## 10.2 Creative QC

Evaluate areas such as:

* hook
* pacing
* story clarity
* narration accuracy
* dead time
* payoff

Channel consistency check family:

* forbidden-word scan against the character
* catchphrase frequency check
* tone/style scoring against the character definition
* later: speaker-similarity regression on narration audio vs a reference sample

Creative QC must not automatically rewrite successful outputs without clear rules.

---

# Phase 11 — Product Experience

Improve the dashboard and project experience.

Add:

* dashboard grouping and filtering by channel
* processing timeline
* detailed statuses
* video preview
* analysis viewer
* script viewer
* edit plan viewer
* final video download
* clear failure recovery

---

# Phase 12 — Production Hardening

Before considering the initial product stable:

* security review
* authorization review
* failure testing
* job retry testing
* large-upload testing
* worker recovery testing
* observability
* backup considerations
* dependency review
* performance review
* cost review
* channel consistency regression testing (same character + settings across runs stays on-style)

---

# Explicitly Deferred

Do not implement these until separately approved:

* YouTube Shorts
* TikTok
* Instagram Reels
* automatic publishing
* billing
* subscriptions
* team workspaces
* multi-game support
* mobile apps
* public SaaS onboarding

---

# Development Rule

Only one defined phase or sub-phase should be implemented per task unless explicitly requested otherwise.

Every implementation task should:

1. follow repository documentation
2. avoid unrelated changes
3. run relevant validation
4. report deviations
5. leave the repository in a working state
