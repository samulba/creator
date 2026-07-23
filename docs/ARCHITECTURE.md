# Creator — System Architecture

## Architecture Goal

Creator must be built as a modular, production-ready system.

Large video uploads, AI processing, FFmpeg rendering, and long-running jobs must not depend on short-lived web request execution.

The web application, storage, database, AI services, and video processing infrastructure must remain clearly separated.

---

## Core Technology Stack

### Web Application

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- Vercel for web hosting

The web application is responsible for:

- user interface
- authentication flows
- project management
- upload initiation
- job status display
- video preview
- user actions
- API orchestration

The web application must not perform heavy video rendering or long-running FFmpeg processing directly.

---

## Database and Authentication

Use:

- Supabase Postgres
- Supabase Auth

Supabase is responsible for structured application data such as:

- users
- video projects
- source assets
- processing jobs
- analysis results
- scripts
- voiceovers
- edit plans
- render outputs
- job statuses

Large video files should not be stored directly inside the database.

---

## Video and Asset Storage

Use Cloudflare R2 for object storage.

R2 will eventually store:

- original gameplay files
- analysis proxies
- extracted audio
- generated voiceovers
- intermediate render assets
- final rendered videos

Buckets should remain private by default.

Access to private assets should use controlled server-side authorization and signed URLs where appropriate.

Large uploads should eventually support direct and resumable uploads without routing the full file through Vercel.

---

## Video Processing

Heavy processing must run outside Vercel.

Use a dedicated video worker architecture.

The worker will eventually handle:

- FFprobe metadata extraction
- FFmpeg preprocessing
- proxy generation
- audio extraction
- video segmentation
- automated editing
- audio mixing
- captions
- effects
- rendering
- output validation

The worker should run in a containerized environment.

Preferred technologies:

- Docker
- FFmpeg
- FFprobe
- Python or TypeScript where appropriate

Infrastructure provider details may evolve, but the worker must remain logically separate from the web application.

---

## AI Services

The architecture must support replaceable AI providers.

Initial intended providers:

### Video Understanding

Gemini API

Primary responsibilities:

- gameplay analysis
- event detection
- temporal understanding
- detailed analysis of selected moments

### Story and Reasoning

Use an abstracted LLM service layer.

Responsibilities:

- story selection
- narrative structure
- script generation
- edit planning
- quality evaluation

Do not tightly couple core business logic to one AI provider.

### Voice Generation

ElevenLabs API

Responsibilities:

- narrator voice generation
- voice consistency
- expressive narration output

---

## Background Jobs

Long-running operations must use asynchronous background jobs.

Examples:

- upload processing
- proxy generation
- AI analysis
- voice generation
- video rendering
- quality control

The system must track job state explicitly.

Typical statuses may include:

- queued
- processing
- completed
- failed
- cancelled

Jobs must be retryable where safe.

Failures must never silently disappear.

---

## High-Level Flow

User

↓

Next.js Web App

↓

Supabase / Application API

↓

Cloudflare R2 + Background Job System

↓

Video Worker

↓

AI Services + FFmpeg Processing

↓

Final Render

↓

Cloudflare R2

↓

Web App Preview / Download

---

## Architecture Rules

1. Never run heavy video processing directly inside normal Vercel request handlers.
2. Never expose private API credentials to the browser.
3. Never store large binary video files directly in Postgres.
4. Keep AI providers behind internal service abstractions.
5. Long-running work must be represented as background jobs.
6. Every processing stage must have observable status and error handling.
7. Infrastructure should be replaceable without rewriting the entire application.
8. Avoid premature complexity, but do not create shortcuts that make production reliability impossible.
9. Major architectural deviations must be documented before implementation.
10. `/docs` is the source of truth for architectural decisions.
