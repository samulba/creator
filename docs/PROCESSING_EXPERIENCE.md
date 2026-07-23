# Creator — Processing Experience

## Purpose

Creator may take a long time to process videos. The processing experience must build trust without exposing infrastructure complexity or using fake precision.

## Processing UX Principles

1. Show real progress when it exists.
2. Use semantic stages for uncertain work.
3. Explain what the system is doing in user language.
4. Make background processing safe and obvious.
5. Preserve completed work after failures.
6. Surface partial results when they become useful.
7. Avoid meaningless percentages for AI and rendering stages unless backed by real measurable progress.

## Semantic Stages

### 1. Uploading

Real file-transfer progress is shown.

User sees:

- File name.
- Uploaded amount.
- Transfer speed when useful.
- Pause/resume only if supported reliably.

### 2. Preparing footage

Covers validation, media probing, and proxy preparation.

User copy: “Checking the recording and preparing it for analysis.”

### 3. Understanding gameplay

Covers coarse analysis and match understanding.

User copy: “Identifying match structure, chases, rescues, mistakes, and turning points.”

### 4. Finding key moments

Covers candidate moment detection and deep analysis.

User copy: “Looking closer at the moments most likely to shape the video.”

### 5. Building story

Covers story angle selection and narrative structure.

User copy: “Choosing the strongest narrative based on what happened in the match.”

### 6. Writing narration

Covers timestamp-aware script generation.

User copy: “Writing narration that supports the gameplay without overexplaining it.”

### 7. Generating voice

Covers narrator audio generation.

User copy: “Creating the voiceover track.”

### 8. Building edit

Covers edit decision list and timeline construction.

User copy: “Choosing cuts, timing narration, and shaping the final sequence.”

### 9. Rendering

Covers final video rendering.

User copy: “Rendering the final video from the original recording.”

### 10. Quality check

Covers technical and creative validation.

User copy: “Checking the final video before review.”

### 11. Ready

Final output is available.

User copy: “Your video is ready to review.”

## Progress Presentation

### Recommended component

Use a vertical or horizontal stage tracker with:

- Completed stages.
- Current stage.
- Upcoming stages.
- Current activity line.
- Last updated timestamp.

### Time estimates

Use cautious language:

- “This can take a while for long recordings.”
- “You can leave this page. Creator will keep working.”
- “Rendering often takes longer than earlier stages.”

Avoid precise estimates unless the system has reliable historical data.

## Background Processing

Users can:

- Leave the project page.
- Return from dashboard.
- Close the browser after upload completes.
- Review partial results when available.
- Cancel processing.

Users cannot safely:

- Close the browser during non-resumable upload.
- Edit the same decision currently being regenerated.
- Download a final output before QC passes.

## Partial Results

Show partial outputs only when they help the user:

- After gameplay understanding: match summary and detected major moments.
- After story building: selected story angle and alternatives.
- After writing narration: script preview.
- After building edit: high-level edit plan.
- After rendering: preview pending QC if safe, clearly marked.

Do not show raw AI output as a primary interface.

## Notifications

### In-app notifications

- Upload complete.
- Story ready to review.
- Script ready.
- Video ready for review.
- Processing failed.

### External notifications

Near-term product may add email notifications for:

- Video ready.
- Processing failed.

Do not require notifications for MVP completion.

## Failure States

### Upload failed

Message: “The upload did not finish.”

Actions:

- Retry upload.
- Choose a different file.

### Unsupported media

Message: “Creator could not read this recording.”

Actions:

- View supported formats.
- Upload a different file.

### Analysis failed

Message: “Creator could not understand enough of the gameplay to build a reliable video.”

Actions:

- Retry analysis.
- Replace source.
- View details.

### AI provider failed

Message: “A generation step did not complete.”

Actions:

- Retry.
- Try later.

The user-facing message should not name the provider unless it helps support.

### Render failed

Message: “Creator could not render the final video.”

Actions:

- Retry render.
- Review edit decisions if the failure is caused by missing assets.
- Contact support.

### Partial pipeline failure

If analysis succeeded but voice or render failed, preserve completed analysis, story, and script. The user should not have to restart from upload unless required.

### Cancelled processing

Show cancelled state and allow archive, delete, or restart where safe.

### Recovering projects

If the app detects an interrupted state, show: “Creator is checking where this project left off.” Then resume or present recovery actions.

## Retry Rules from UX Perspective

- Retry should resume from the failed stage where safe.
- Retry should not duplicate approved outputs.
- Retry should preserve previous generated versions.
- Destructive retries must explain what will be replaced.

## What Not to Show

Do not show normal users:

- Raw worker logs.
- Queue names.
- Provider request IDs.
- Token counts.
- Proxy file lists.
- FFmpeg command output.

Use expandable support details only when necessary.
