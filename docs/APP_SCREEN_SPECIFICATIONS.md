# Creator — Application Screen Specifications

## Dashboard

### Purpose

Show current video projects and provide a clear path to create a new long-form video.

### Layout

- Top bar with product name, user menu, and **Create New Video** button.
- Main content width constrained for readability.
- Active Projects section.
- Recent Projects section.
- Empty state when no projects exist.

### Project row content

- Project title.
- Current semantic state.
- Last updated.
- Source duration if known.
- Target length.
- Primary quick action.

### State-specific quick actions

- Draft: Continue setup.
- Uploading: View upload.
- Processing: View progress.
- Failed: Review issue.
- Ready for review: Review video.
- Approved: Download.

### Empty state

Copy should explain: “Upload a Dead by Daylight match and Creator will turn it into a long-form YouTube video.”

Primary action: **Upload Gameplay**.

## New Video Screen

### Purpose

Collect the minimum information needed to start production.

### Layout

- Large upload drop zone.
- Compact settings panel.
- Summary and primary action.

### Upload drop zone

States:

- Empty.
- File selected.
- Uploading.
- Upload paused or failed.
- Unsupported file.

### Settings

1. Channel (required, first; implies language, narrator character, dials, edit style).
2. Optional overrides: target length (Auto, Shorter, Standard, Longer), creative direction (Balanced, Funnier, More Dramatic, More Analytical), narrator character.

### Primary action

**Create Video**.

Disabled until a valid source file is selected and required settings are valid.

## Project Overview

### Purpose

Provide the project's current state and the next best action.

### Processing state layout

- Large stage label.
- Short explanation of current work.
- Completed stage checklist.
- Estimated behavior, not fake exact time.
- Partial results if available.

### Ready state layout

- Video preview summary.
- Story angle summary.
- Chapters.
- Primary action: **Review Video**.

### Failed state layout

- Failed stage.
- Human-readable explanation.
- Safe action buttons.
- Expandable technical details.

## Review Screen

### Purpose

Allow the user to watch, inspect, change, approve, and download the final video.

### Layout

- Main video player.
- Right-side chapter/story structure panel on desktop.
- Bottom change bar or timestamp action menu.
- Version selector.
- Approve/download actions.

### Player features

- Standard playback controls.
- Chapter markers.
- Clickable moments.
- Current script section highlight when available.

### Review actions

- Approve version.
- Request targeted change.
- Compare versions.
- Download approved output.

## Story Screen

### Purpose

Show the narrative logic behind the video.

### Content

- Selected story angle.
- One-paragraph story summary.
- Story structure: hook, setup, escalation, turning point, climax, payoff.
- Key moments used.
- Alternate angles when available.

### Actions

- Choose alternate angle.
- Open moment in review player.
- Exclude or restore moment.

## Script Screen

### Purpose

Allow review and targeted editing of narration.

### Content

- Script divided into timestamp-aware sections.
- Linked moment/chapter for each section.
- Narrator and language metadata.

### Actions

- Edit text.
- Regenerate selected section.
- Regenerate chapter narration.
- Change narrator.

### Rules

Script edits should validate that narration remains associated with timeline sections. The UI should warn if a change may require voice regeneration or edit timing updates.

## Edit Decisions Screen

### Purpose

Expose high-level edit control without becoming a timeline editor.

### Content

- Included moments.
- Excluded moments.
- Pacing setting.
- Narration density.
- Gameplay preservation setting.
- Edit notes from Creator.

### Actions

- Exclude moment.
- Restore moment.
- Adjust pacing.
- Adjust narration density.
- Regenerate affected edit.

## Output Screen

### Purpose

Manage rendered versions and downloads.

### Content

- Current approved version if any.
- Latest render.
- Prior versions.
- QC status.
- File metadata.
- Download action.

### Actions

- Download.
- Approve version.
- Compare version.
- Delete unneeded draft version where safe.

## Settings Screen

### MVP content

Two sections (see `docs/CHANNEL_CHARACTER_MODEL.md`):

**Channels**

- List of the user's YouTube channels.
- Create/edit: name, YouTube handle, description, default character, default language, the five creative dials, edit-style tokens (captions, zooms, transitions, intro/outro).
- Archive instead of delete in normal use.

**Characters**

- List of the user's narrator characters (reusable across channels).
- Create/edit: name, description, language, voice (provider voice id + voice settings), speech style (tone, humor level, energy, sentence length, vocabulary notes, catchphrases, forbidden words, and — prominently — example lines).
- Archive instead of delete; deletion is refused while referenced by active projects.

Do not include provider keys, billing, or worker settings in normal user settings. The ElevenLabs API key never appears here — `voice_key` is a voice identifier, not a credential.
