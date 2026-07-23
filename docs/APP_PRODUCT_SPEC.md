# Creator — Application Product Specification

## Purpose

Creator is a professional web application that turns raw Dead by Daylight gameplay into polished long-form YouTube videos. The product hides the technical pipeline behind a simple creative workflow: upload gameplay, choose a small number of creative preferences, wait while Creator builds the video, review the result, request targeted changes, and download the final render.

This document defines the final application from the user's perspective. It preserves the existing architecture: Next.js web app, Supabase data/auth, private Cloudflare R2 media storage, asynchronous background jobs, dedicated video workers, AI provider abstraction, Gemini for video understanding, ElevenLabs for voice generation, inspectable edit decision lists, and worker-based rendering.

## Product Promise

A creator should be able to upload one raw gameplay recording and receive a coherent, story-driven, long-form YouTube video without understanding AI analysis, proxies, queues, FFmpeg, model calls, or rendering infrastructure.

The product does not promise instant generation. It promises a calm, reliable production process with clear state, useful partial outputs, high-leverage creative control, and a reviewable final video.

## Primary Audience

### Primary user

A Dead by Daylight content creator who records full gameplay matches and wants long-form YouTube videos but does not want to manually perform analysis, scripting, narration, editing, audio mixing, rendering, and quality checks for every match.

### User assumptions

- Understands YouTube content quality.
- Understands their own channel voice and audience.
- May not be a professional editor.
- Does not want to manage technical production tools.
- Wants to approve the finished video before using it.

## Product Scope

### MVP

The MVP should support one complete production path:

1. Create a video project.
2. Upload one raw Dead by Daylight gameplay file.
3. Configure only essential creative settings.
4. Process the gameplay through the pipeline.
5. Generate one primary story, script, voiceover, edit, render, and quality check.
6. Review the final video.
7. Make limited targeted changes.
8. Download the approved video.

### Near-term product

Near-term improvements may add:

- Multiple story angles before committing to a render.
- More granular script edits.
- Moment-level include/exclude controls.
- Version comparison.
- Project recovery after failures.
- Better processing notifications.
- Re-rendering selected sections where the pipeline supports it safely.

### Future advanced functionality

Future functionality may include:

- Channel-specific creative profiles.
- Reusable narrator and tone presets.
- Automatic title, description, and chapter drafts.
- Thumbnail concept support.
- Batch uploads.
- Multi-match compilation workflows.
- Team review.
- Automatic publishing.

These are not part of the initial product unless separately approved.

## Explicit Non-goals

Do not build these into the primary app experience now:

- YouTube Shorts.
- TikTok or Instagram Reels.
- Billing and subscription UX.
- Team workspace administration.
- Generic multi-game workflows.
- A full non-linear timeline editor.
- Prompt-first creation.
- Chat-based editing as the main interface.
- Decorative AI branding, sparkle motifs, or constant suggestions.

## Primary User Journey

1. User opens Creator.
2. User lands on the Dashboard.
3. User selects **Create New Video**.
4. User uploads raw gameplay.
5. User confirms a few essential project settings.
6. Creator uploads and validates the source.
7. Creator processes the gameplay in semantic stages.
8. Creator identifies match events and candidate story angles.
9. Creator writes narration and constructs an edit.
10. Creator renders and quality-checks the video.
11. User reviews the final output.
12. User makes targeted changes if needed.
13. Creator generates a revised version when required.
14. User approves the final output.
15. User downloads the final video.

## Product States

A project should always present one clear state:

- **Draft** — created but missing required input.
- **Uploading** — source file is actively uploading.
- **Preparing** — source validation, probing, and proxy preparation.
- **Understanding gameplay** — analysis and moment detection.
- **Building story** — story selection, structure, and script work.
- **Generating voice** — narration audio creation.
- **Building edit** — edit plan and timeline construction.
- **Rendering** — final render is being produced.
- **Checking quality** — technical and creative checks are running.
- **Ready for review** — final output is available but not approved.
- **Approved** — user approved the output.
- **Failed** — processing stopped and requires user action or support.
- **Cancelled** — user intentionally stopped the project.
- **Archived** — hidden from active project lists.

## What the User Should Understand

Users should understand:

- What Creator is doing in plain language.
- Whether they need to do anything.
- Whether partial work is ready to review.
- What went wrong if a failure occurs.
- What change options are available.
- Which version is currently approved.

Users should not need to understand:

- Queue names.
- Worker names.
- Model names.
- FFmpeg steps.
- Proxy assets.
- Provider retry logic.
- Internal job IDs.

## Key Product Requirements

### Simplicity

The creation flow should feel like:

Upload → choose a small creative direction → create video.

### Grounded output

Narration and story decisions must be grounded in analyzed gameplay. The product should never present invented events as facts.

### Reviewability

Users must be able to inspect high-level story structure, script, important moments, and final output.

### Reproducibility

The app should preserve generated versions, settings, and decisions so users can compare and recover prior outputs.

### Reliability

Long-running work must be resumable where possible, retryable where safe, and transparent when failed.

### Professional restraint

The application should feel like focused creative software, not a generic SaaS dashboard or AI novelty tool.
