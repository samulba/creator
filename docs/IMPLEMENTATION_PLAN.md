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
`worker/src/ai/` behind a `GenerativeProvider` interface; the job handler is
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

`worker/src/ai/types.ts` defines the `GenerativeProvider` interface (analysis +
story + script) and `VoiceProvider` (Phase 7); `worker/src/ai/index.ts` is a
factory returning `null` when no provider is configured. Provider-specific code
(Gemini, ElevenLabs) stays behind the boundary, so another model/vendor can be
added without touching the handlers.

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

The mainline now goes coarse analysis → `story_generation` directly. A deeper
per-moment analysis pass (`deep_analysis`) remains a planned refinement that can
be inserted before story generation without changing the story handler.

---

# Phase 6 — Story Engine

Status: 6.1, 6.2, and 6.3 are **done** as the `story_generation` and
`script_generation` worker jobs. Data model:
`supabase/migrations/008_story_and_script.sql` (story_versions,
story_version_moments, script_versions, script_sections;
`projects.selected_story_version_id`). Handlers:
`worker/src/jobs/story-generation.ts`, `worker/src/jobs/script-generation.ts`;
prompts + schemas in `worker/src/ai/context.ts` + `worker/src/ai/story-schema.ts`.

Honest boundary: the story/script schema validators, prompt assembly,
forbidden-word enforcement, and catchphrase counting are unit-tested
(`worker/src/ai/story-schema.test.ts`). The live Gemini text calls require a
real `GEMINI_API_KEY` and are not end-to-end tested; without the key the worker
does not claim these jobs and the pipeline pauses at *Understanding gameplay*.
Migration 008 must be applied first.

## 6.1 Story Director — done

`story_generation` reads the grounded candidate moments and asks Gemini to pick
the single strongest narrative angle and the moments that carry it (referencing
moment indices, never inventing). Writes a selected `story_versions` row +
`story_version_moments`, and points `projects.selected_story_version_id` at it.

## 6.2 Narrative Structure — done

The story response carries a `structure` object (hook, setup, escalation,
turning_points, climax, payoff), validated and stored on the story version.

## 6.3 Script Generation — done

`script_generation` turns the selected story + beats into timestamp-aware
narration in the character's voice, written into `script_versions` +
`script_sections`. Channel consistency:

* prompt assembly consumes the character's `speech_style`; `example_lines` are the primary style anchor
* `forbidden_words` are enforced hard (a violation fails the job and retries); catchphrase usage is recorded as a soft budget in `generation_metadata`
* prompt templates are versioned in code (`script-v1`); every generation records `model_id`, `prompt_template_version`, `character_config_hash`, and catchphrase counts in `generation_metadata`
* the resolved character config is frozen into `script_versions.narrator_config` (second freeze point)

---

# Phase 7 — Voice Engine

Status: 7.1 is **done** as the `voice_generation` worker job; 7.2 (voice
direction) is partially covered — the pinned per-character `voice_settings`
(stability, similarity, style, speed) are passed through; richer per-line
direction is deferred. Data model:
`supabase/migrations/009_narration_assets.sql`. Provider:
`worker/src/ai/elevenlabs.ts` behind a `VoiceProvider` interface; config
resolution in `worker/src/ai/voice.ts`; handler
`worker/src/jobs/voice-generation.ts`.

Honest boundary: voice-config resolution (pinned model, never "latest"),
request-body building, and output-format mapping are unit-tested
(`worker/src/ai/voice.test.ts`). The live ElevenLabs HTTP call requires a real
`ELEVENLABS_API_KEY` and is not end-to-end tested. Without the key the worker
does not claim `voice_generation` and the pipeline pauses at *Generating
voice*. Migration 009 must be applied first.

## 7.1 ElevenLabs Integration — done

* secure API integration (server-side key, never in a browser bundle)
* narrator voice from the project's character (`voice_key` + `voice_settings`, model **pinned** per character via `voice_settings.model_id` — never a "latest" alias)
* generated audio stored as `narration_audio` assets in R2
* metadata frozen per narration asset (`voice_config`) + provider request id in `generation_metadata`
* error handling: a missing/deleted provider voice is a first-class non-retryable failure (`VOICE_MISSING`); a narrator without a voice fails with `VOICE_NOT_CONFIGURED`

## 7.2 Voice Direction — partial

The character's `voice_settings` (stability, similarity_boost, style, speed) are
resolved, clamped, and applied per request. Finer per-line direction (explicit
pauses, emphasis, emotional delivery) is deferred to a later iteration where the
provider supports it reliably.

---

# Phase 8 — Edit Engine

Status: 8.1 and 8.2 are **done** as the `edit_planning` worker job. Data model:
`supabase/migrations/010_edit_engine.sql` (edit_versions, edit_segments). The
EDL builder is `worker/src/edit/edl.ts` (pure, unit-tested in `edl.test.ts`);
the handler is `worker/src/jobs/edit-planning.ts`. **No AI provider or API key
needed** — the plan is deterministic, so this stage always runs.

## 8.1 Edit Decision List — done

`edit_planning` assembles a deterministic EDL from the selected story's ordered
beats, their candidate source ranges, the script sections, and the channel's
enumerated `edit_style` tokens. Each beat becomes one gameplay segment with a
source range and an effect summary. Writes `edit_versions` (a jsonb EDL +
summary) and `edit_segments` (one row per output segment). The
`gameplay_preservation` dial caps per-clip length (preserve_more = uncapped,
balanced = 20s, cut_more_aggressively = 10s). Voiceover placement, game-audio
levels, zoom/caption tokens are recorded; freeze frames + optional effects are
deferred.

Channel consistency: the EDL reads the settings snapshot's `edit_style` and
stores enumerated caption/zoom/transition tokens, never freeform strings.

## 8.2 Timeline Builder — done

The EDL is already a deterministic timeline: segments carry contiguous
`output_start_ms`/`output_end_ms`, and the render engine executes them without
re-deciding anything creative. Creative intent (tokens, dials) stays in the
plan; low-level FFmpeg lives in the render engine.

---

# Phase 9 — Render Engine

Status: 9.1 and 9.2 are **done** as the `render` worker job. Data model:
`supabase/migrations/011_render_engine.sql` (output_versions, render_attempts).
FFmpeg building blocks: `worker/src/render/ffmpeg-render.ts`; handler:
`worker/src/jobs/render.ts`. Runs on the worker's FFmpeg — no external API key.

Honest boundary: the FFmpeg render pipeline (segment extraction, concat,
narration positioning with audio ducking, final mix) was smoke-tested locally
on generated media (the exact filter graphs the worker runs, including the
`sidechaincompress` duck and `asplit` fix). The full end-to-end render against a
real multi-GB source + real narration in R2 could not be run from the build
environment; the first real render is the true integration test. Retries reuse
the output version and add a new render_attempt.

## 9.1 Automated Video Rendering — done

`render` cuts each EDL segment from the source (input-seek + re-encode to a
uniform 1080p/30fps), concatenates them (concat demuxer, stream copy), builds a
narration track positioned on the output timeline (adelay + amix), ducks the
gameplay audio under narration (sidechain compression), and encodes a faststart
MP4. The result is uploaded as a `final_video` asset. Cuts, source sequencing,
voiceover, gameplay audio, audio ducking, and final encoding are implemented;
**basic zooms and burned-in captions are deferred** (documented in
`worker/README.md`). Narration is best-effort: with no narration assets the
render produces a valid gameplay-only video.

## 9.2 Render Validation — done

After render, the output is re-probed with ffprobe: the render fails unless a
readable video stream, an audio stream, and a positive duration are present. The
technical metadata (duration, resolution, codecs, segment/narration counts) is
recorded on the `render_attempts` row; the `output_versions` row is marked
`rendered` with its `final_asset_id`, and the project advances to
*Checking quality* (Phase 10 QC, which stays queued until built).

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
