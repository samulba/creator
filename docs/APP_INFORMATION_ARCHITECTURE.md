# Creator — Application Information Architecture

## IA Goal

Creator's information architecture should make a complex media-production pipeline feel like a small number of obvious creative states. The user should always know where they are, what the project needs, and what output is available.

## Top-level Navigation

### MVP navigation

1. **Dashboard**
   - Project list.
   - Create video action.
   - Project status and recent activity.

2. **Project Workspace**
   - One project at a time.
   - Processing state, creative review, final output.

3. **Settings**
   - Minimal user-level preferences.
   - Default language, default narrator, and export preferences when supported.

### Navigation not needed in MVP

- Billing.
- Teams.
- Marketplace.
- Prompt libraries.
- AI playgrounds.
- Worker dashboards.
- Provider settings for normal users.

## Dashboard IA

The Dashboard is a quiet command center, not an analytics page.

### Primary dashboard regions

1. **Header**
   - Product name or workspace label.
   - Primary action: **Create New Video**.
   - Optional user menu.

2. **Active Projects**
   - Projects currently uploading, processing, failed, or ready for review.
   - Sorted by urgency: failed and ready for review first, then processing, then uploading.

3. **Recent Projects**
   - Recently completed or edited projects.
   - Simple list with key metadata.

4. **Empty State**
   - Clear explanation of what Creator does.
   - One primary action: **Upload Gameplay**.

### Project list metadata

Each project row/card should show only useful data:

- Project title or source filename-derived title.
- Current semantic state.
- Last updated time.
- Source duration when known.
- Target video length.
- Current version count when versions exist.
- Failure summary if failed.
- Review status if ready.

Avoid showing:

- Internal job IDs.
- Provider names.
- Technical progress logs.
- Raw queue details.
- Token counts.
- Proxy details.

## Project Workspace IA

The Project Workspace should be organized around user decisions, not pipeline internals.

### Recommended MVP workspace structure

1. **Overview**
   - Current project state.
   - Next required action.
   - Processing progress.
   - Final preview when ready.
   - Key project settings.

2. **Review**
   - Final video player.
   - Chapters/story beats.
   - Targeted change controls.
   - Version status.
   - Approve and download actions.

3. **Story**
   - Selected story angle.
   - Alternate story angles when available.
   - Story structure.
   - Important gameplay moments.

4. **Script**
   - Timestamp-aware narration sections.
   - Edit selected narration.
   - Regenerate selected narration.
   - Change narrator where supported.

5. **Edit Decisions**
   - High-level edit plan.
   - Included/excluded moments.
   - Pacing controls.
   - Advanced, collapsed by default.

6. **Output**
   - Rendered versions.
   - QC state.
   - Download.
   - Export metadata when supported.

### Simpler presentation rule

Normal users should first see **Overview** and **Review**. Story, Script, Edit Decisions, and Output can be accessible as tabs or side sections, but they should not compete with the primary video review experience.

## Normal vs Advanced Visibility

### Normal user default view

Show:

- Project status.
- Processing stage.
- Story summary.
- Final video preview.
- Chapter list.
- Simple creative controls.
- Approve/download actions.
- Clear errors and retry actions.

Hide by default:

- Full technical analysis JSON.
- Raw edit decision list.
- Worker logs.
- Provider names.
- Encoding settings.
- Asset manifests.

### Advanced user expandable view

Expose only when useful:

- Detailed moment list.
- Script timestamps.
- Edit decision details.
- Media metadata.
- Job history summaries.
- Quality-check details.

Advanced views should remain read-friendly and productized. They should not expose raw infrastructure dumps as primary UI.

## Entity Model from the User Perspective

### Project

A project is one video production workflow based on one source gameplay recording.

### Source

The uploaded raw gameplay file.

### Story angle

A possible narrative direction grounded in the match.

### Moment

A time range that matters creatively: chase, mistake, rescue, turning point, funny event, climax, payoff.

### Script section

A timestamp-aware piece of narration connected to one or more moments.

### Edit plan

The high-level creative blueprint for the final video.

### Version

A rendered output created from a specific set of story, script, edit, narrator, and pacing decisions.

### Approval

The user's explicit confirmation that a version is final.

## URL Structure Recommendation

- `/app` — dashboard.
- `/app/new` — new video flow.
- `/app/projects/[projectId]` — project overview.
- `/app/projects/[projectId]/review` — review and final output.
- `/app/projects/[projectId]/story` — story and moments.
- `/app/projects/[projectId]/script` — narration script.
- `/app/projects/[projectId]/edit` — high-level edit controls.
- `/app/projects/[projectId]/output` — versions and downloads.
- `/app/settings` — minimal user preferences.

The UI may use tabs, nested routes, or panels, but the IA should preserve these conceptual destinations.
