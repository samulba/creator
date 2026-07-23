# Creator — Database Model

## Purpose

This document defines the production-ready relational data model for the Creator MVP on Supabase Postgres. It is an implementation specification only: do not create remote tables, application code, or Supabase clients from this document directly without a separate implementation task.

Creator stores structured application state in Postgres and stores all binary media in private Cloudflare R2. Supabase Auth owns identity. Postgres owns authorization boundaries through Row Level Security (RLS), constraints, and foreign keys.

## Design Principles

1. One authenticated Supabase user owns each MVP project.
2. A project represents one complete long-form Dead by Daylight video production based on one source gameplay recording.
3. Binary files never live in Postgres; database rows store metadata and private storage references.
4. Long-running work is represented by durable jobs that can be retried, leased by workers, and audited at a minimal operational level.
5. Generated creative state is versioned where it can affect rendered output.
6. AI output is stored as validated structured data, not as opaque raw provider dumps.
7. JSONB is allowed for bounded, schema-validated payloads, provider metadata, and EDL internals, but core relationships and user-visible state remain relational.
8. Browser clients never provide trusted ownership fields. Ownership is derived from `auth.uid()` server-side/database-side.

## Canonical Entity Groups

### Identity

#### `auth.users`

Managed by Supabase Auth. Creator must not duplicate authentication data.

#### `profiles`

A lightweight application profile is needed because application preferences and profile lifecycle should not be stored in `auth.users` metadata.

Belongs here:

- `id` matching `auth.users.id`
- display name
- default target language
- default narrator key
- default export preferences once supported
- app onboarding flags if needed
- timestamps

Does not belong here:

- passwords
- billing data
- provider credentials
- team membership
- large settings blobs unrelated to MVP

### Projects

#### `projects`

A project is one video production workflow from one raw gameplay upload to one or more generated render versions.

Key responsibilities:

- user ownership
- title and optional description
- precise internal pipeline state
- simplified user-facing status derivable from internal state
- target language
- target length preference
- current creative settings snapshot
- selected source asset
- selected/approved output version references
- archive/delete lifecycle fields
- failure summary fields

The project row should be the dashboard-friendly aggregate root. Detailed generated data lives in child tables.

### Creative Settings

#### `project_creative_settings`

Stores versioned creative director settings. A project has one active settings row at a time, and output versions reference the settings snapshot used to create them.

MVP dimensions:

- creative direction: `balanced`, `funnier`, `more_dramatic`, `more_analytical`
- pacing: `relaxed`, `balanced`, `tight`
- narration density: `light`, `balanced`, `detailed`
- gameplay preservation: `preserve_more`, `balanced`, `cut_more_aggressively`
- target length: `auto`, `shorter`, `standard`, `longer`

Use explicit enums or check-constrained text values so invalid settings cannot enter the database.

### Assets

#### `assets`

Generic metadata table for all stored media and artifacts. One table is preferred for MVP because all assets share ownership, storage references, lifecycle, technical metadata, and status. Asset-specific details are stored in typed columns plus bounded JSONB.

Asset categories include:

- original gameplay source
- analysis proxy video
- extracted audio
- frame sample collection or manifest
- generated narration audio
- intermediate render artifact
- final rendered video
- thumbnail/preview image when later needed
- caption file when later needed

The asset record stores private R2 location details, checksum, file size, MIME type, media metadata, duration, status, and lifecycle fields. The R2 object key must be generated server-side and never be derived directly from an unsafe user filename.

### Processing Jobs

#### `processing_jobs`

Durable representation of asynchronous work. Jobs belong to a project and usually reference input/output assets or generated records through `payload` and typed nullable foreign keys where useful.

Jobs track:

- job type
- status
- priority
- attempts and maximum attempts
- idempotency key
- dependency/parent job
- leasing fields for workers
- progress stage and current activity
- safe user-facing failure summary
- support-only error code/details
- timestamps

Normal users may view sanitized job status for their projects. Browser clients must not claim, lease, complete, or fail jobs directly.

### Analysis

#### `analysis_runs`

One analysis run groups coarse analysis, candidate detection, and deep analysis data produced from a source/proxy asset and a specific processing configuration.

Stores:

- run type: coarse, deep, combined
- status
- source asset/proxy asset references
- model/provider metadata in bounded JSONB
- summary fields
- started/completed timestamps

#### `gameplay_events`

Relational event table for timestamped detected gameplay facts. This avoids a single huge JSON blob while keeping the model practical.

Stores:

- event type
- start/end time in milliseconds
- confidence
- importance score
- title/summary/reason
- actor labels where known
- evidence metadata in JSONB
- source analysis run

#### `candidate_moments`

Creative moment candidates derived from one or more gameplay events. These are the moments the product can show, include, exclude, and use for story/edit decisions.

Stores:

- moment type
- start/end time
- confidence
- importance
- selection reason
- inclusion state
- user exclusion/restoration metadata
- relation to analysis run and project

Use a join table `candidate_moment_events` when a moment is supported by multiple events.

### Story

#### `story_versions`

Stores selected and alternative narrative directions. Story is versioned because changing the angle can require a new script, voice, edit, and render.

Stores:

- story title/angle
- summary
- status
- selection flag
- structure JSONB for hook/setup/escalation/turning point/climax/payoff
- supporting moment references through a join table
- generation metadata

#### `story_version_moments`

Join table between story versions and candidate moments, with role labels such as hook, setup, escalation, turning_point, climax, payoff.

### Script and Narration

#### `script_versions`

A timestamp-aware narration script generated from a story version and creative settings snapshot.

Stores:

- version number
- status
- language
- narrator key/config snapshot
- full script text for convenient display
- source story version
- generation metadata

#### `script_sections`

Sections of narration tied to timeline ranges and optionally to story moments.

Stores:

- order index
- timeline start/end milliseconds
- text
- intent/beat label
- status
- regeneration lineage
- optional parent section when revised

#### `narration_assets`

Links generated voice audio assets to script sections. This table keeps voice generation metadata separate from generic asset metadata while still using `assets` for the actual stored audio reference.

Stores:

- script section
- asset id
- provider/narrator config snapshot
- duration
- status
- generation metadata

### Edit Plan

#### `edit_versions`

An inspectable Edit Decision List (EDL) version generated from a story, script, creative settings, and included/excluded moments.

Core searchable fields remain relational; the detailed EDL is JSONB with a versioned schema.

Stores:

- version number
- status
- story version
- script version
- creative settings snapshot
- EDL schema version
- timeline duration
- summary notes
- EDL JSONB

#### `edit_segments`

Relational summary of main source ranges and timeline ranges from the EDL for UI, validation, and targeted regeneration.

Stores:

- output timeline start/end
- source asset
- source start/end
- segment type
- linked candidate moment
- narration section
- included flag
- effect summary

### Renders and Output Versions

#### `output_versions`

Represents a meaningful generated video version that a user can review, compare, approve, and download. It references the creative, story, script, edit, and render state used to produce the video.

Stores:

- version number
- status
- story/script/edit/settings references
- final asset reference when available
- QC status
- approval fields
- change summary

Only one output version per project may be approved.

#### `render_attempts`

A render attempt is an execution of the render engine for an output version. Multiple attempts may exist due to retry/failure.

Stores:

- output version
- job id
- status
- input edit version
- output/intermediate asset references
- technical metadata
- failure fields
- timestamps

#### `quality_checks`

Stores technical and creative QC results for an output version or render attempt.

Stores:

- QC type
- status
- passed boolean
- summary
- checks JSONB with bounded schema
- blocking flag

## Canonical Project State Model

### Internal pipeline states

Use precise states for backend orchestration:

- `draft`
- `uploading`
- `upload_complete`
- `validating_source`
- `probing_media`
- `generating_proxy`
- `analyzing_gameplay`
- `detecting_moments`
- `deep_analysis`
- `selecting_story`
- `building_narrative`
- `writing_script`
- `generating_voice`
- `building_edit`
- `rendering`
- `quality_checking`
- `ready_for_review`
- `approved`
- `failed`
- `cancelled`
- `archived`
- `deleting`
- `deleted`

### User-facing status mapping

| Internal state | User-facing status |
| --- | --- |
| `draft` | Draft |
| `uploading` | Uploading |
| `upload_complete`, `validating_source`, `probing_media`, `generating_proxy` | Preparing |
| `analyzing_gameplay` | Understanding gameplay |
| `detecting_moments`, `deep_analysis` | Finding key moments |
| `selecting_story`, `building_narrative` | Building story |
| `writing_script` | Writing narration |
| `generating_voice` | Generating voice |
| `building_edit` | Building edit |
| `rendering` | Rendering |
| `quality_checking` | Checking quality |
| `ready_for_review` | Ready for review |
| `approved` | Approved |
| `failed` | Failed |
| `cancelled` | Cancelled |
| `archived` | Archived |
| `deleting`, `deleted` | Deleted / unavailable |

The UI should display semantic status and copy, not raw queue details or worker internals.

## ER Diagram

```text
auth.users
  │
  └── profiles
        │
        └── projects
              ├── project_creative_settings
              ├── assets
              ├── processing_jobs
              │     └── processing_jobs (parent_job_id)
              ├── analysis_runs
              │     ├── gameplay_events
              │     ├── candidate_moments
              │     │     └── candidate_moment_events ── gameplay_events
              ├── story_versions
              │     └── story_version_moments ── candidate_moments
              ├── script_versions
              │     └── script_sections
              │           └── narration_assets ── assets
              ├── edit_versions
              │     └── edit_segments ── assets / candidate_moments / script_sections
              └── output_versions
                    ├── render_attempts ── processing_jobs / assets
                    └── quality_checks
```

## MVP, Near-term, and Deferred Scope

### MVP tables

- `profiles`
- `projects`
- `project_creative_settings`
- `assets`
- `processing_jobs`
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

### Near-term tables

- `project_change_requests` for constrained review actions
- `project_activity_events` if the dashboard needs a durable product activity feed
- `upload_sessions` if resumable multipart upload state cannot be represented safely in `assets`
- `user_notification_preferences` when external notifications are introduced

### Do not implement yet

- organizations
- teams
- billing/subscriptions
- public sharing
- collaboration comments
- multiple games/catalog tables
- social publishing accounts
- provider/model selectors for normal users
- enterprise audit log tables
