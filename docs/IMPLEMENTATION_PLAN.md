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

Status:

In progress.

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

---

# Phase 1 — Web Application Core

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

* create project
* view project
* list projects
* basic project status
* delete or archive project where appropriate

---

# Phase 2 — Storage and Uploads

## 2.1 Cloudflare R2 Foundation

Add:

* private object storage
* secure credentials
* storage abstraction
* asset metadata model

---

## 2.2 Large Video Upload

Implement:

* direct browser-to-storage upload
* upload progress
* failure recovery
* large-file support
* resumable or multipart upload architecture
* secure project ownership validation

Do not route large video files through normal Vercel request handlers.

---

## 2.3 Source Asset Validation

Add:

* upload completion validation
* file metadata
* source asset state
* validation job creation

---

# Phase 3 — Job System

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

## 4.1 Worker Foundation

Create a separate containerized worker.

Include:

* Docker
* FFmpeg
* FFprobe
* job execution
* structured logging
* health checks
* graceful failure handling

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

## 5.1 AI Provider Abstraction

Create internal provider interfaces before integrating AI deeply.

Avoid spreading provider-specific code across the application.

---

## 5.2 Gemini Video Analysis

Add initial gameplay analysis.

Output must be structured and schema-validated.

Detect:

* match structure
* major events
* potential highlights
* candidate time ranges

---

## 5.3 Candidate Moment Detection

Score and select relevant gameplay moments for deeper analysis.

---

## 5.4 Deep Analysis

Perform more detailed analysis on selected moments.

Generate structured event data suitable for story generation.

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

---

# Phase 7 — Voice Engine

## 7.1 ElevenLabs Integration

Add:

* secure API integration
* configured narrator voice
* generated audio asset storage
* metadata
* error handling

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

Creative QC must not automatically rewrite successful outputs without clear rules.

---

# Phase 11 — Product Experience

Improve the dashboard and project experience.

Add:

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
