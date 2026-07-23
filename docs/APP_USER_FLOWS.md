# Creator — Application User Flows

## Primary Flow: Create a Long-form Video

### Entry

User starts on the Dashboard.

### Steps

1. User selects **Create New Video**.
2. User drops or selects a gameplay file.
3. Creator displays file name, size, and upload readiness.
4. User confirms essential settings:
   - Target language.
   - Narrator.
   - Target length.
   - Creative direction.
5. User selects **Create Video**.
6. Upload begins.
7. User sees upload progress.
8. After upload, Creator validates the source.
9. Project moves into background processing.
10. User can leave the page and return later.
11. Creator progressively reveals available outputs:
    - Match summary.
    - Candidate story angle.
    - Script preview.
    - Rendered version.
12. User reviews final output.
13. User approves or requests targeted changes.
14. User downloads the approved video.

### Success state

The project is marked **Approved**, with a downloadable final MP4.

## New Video Flow

### Inputs required before processing

MVP should ask for only:

1. **Gameplay file**
   - Required.
   - One raw gameplay video.

2. **Language**
   - Default from user settings or English.
   - Required only if no default exists.

3. **Narrator**
   - Default narrator selected automatically.
   - User can change with one compact selector.

4. **Target length**
   - Default: Auto, targeting approximately 8–15 minutes.
   - Options: Auto, Shorter, Standard, Longer.
   - Avoid exact minute sliders in MVP.

5. **Creative direction**
   - Default: Balanced.
   - Options: Balanced, Funnier, More Dramatic, More Analytical.

### Inputs that should not be required before processing

- Codec settings.
- Resolution settings.
- Bitrate settings.
- Model selection.
- Prompt text.
- Timeline settings.
- Caption styling.
- Music selection.
- Advanced voice parameters.

### New video completion

After clicking **Create Video**, the user is taken to the Project Workspace Overview. Upload and processing states continue there.

## Processing Flow

1. Project enters **Uploading**.
2. Upload progress is shown as real transfer progress.
3. Project enters **Preparing footage**.
4. Creator validates and prepares media.
5. Project enters **Understanding gameplay**.
6. Creator detects match events and moments.
7. Project enters **Finding the story**.
8. Creator selects a story angle and structure.
9. Project enters **Writing narration**.
10. Creator generates the script.
11. Project enters **Generating voice**.
12. Creator creates narrator audio.
13. Project enters **Building edit**.
14. Creator builds the edit plan and timeline.
15. Project enters **Rendering**.
16. Creator renders the video.
17. Project enters **Checking quality**.
18. Creator validates output.
19. Project enters **Ready for review**.

## Review and Approval Flow

1. User opens a ready project.
2. Video player appears as the primary object.
3. Side panel shows story chapters.
4. User watches the video.
5. User can jump to chapters or AI decisions.
6. User chooses one of:
   - **Approve**.
   - **Request changes**.
   - **Download preview** if allowed.
7. If approved, project is marked **Approved**.
8. Download becomes the primary action.

## Targeted Change Flow

### Change entry points

Users can request changes from:

- Video timestamp.
- Chapter.
- Script section.
- Moment list.
- Creative direction panel.

### Supported MVP changes

- Edit selected narration text.
- Regenerate selected narration.
- Exclude a moment.
- Restore an excluded moment.
- Change pacing globally.
- Change narrator and regenerate voice.
- Select a different story angle if available before final approval.

### Flow

1. User selects a timestamp, chapter, script section, or moment.
2. User chooses a constrained action.
3. Creator explains what will be regenerated.
4. User confirms.
5. Creator creates a new version or revision job.
6. Original version remains available.
7. User compares or reviews the new version.
8. User approves one version.

## Alternate Story Flow

1. During or after story generation, Creator shows the selected story angle.
2. If alternatives are available, the user can open **Other possible angles**.
3. Each angle shows:
   - Title.
   - One-sentence premise.
   - Key moments used.
   - Expected tone.
4. User selects another angle.
5. Creator explains that script, voice, edit, and render may need regeneration.
6. User confirms.
7. New version is created.

## Failure Recovery Flow

1. Project enters **Failed**.
2. Dashboard and workspace clearly show the failed stage in user language.
3. Error message explains impact, not infrastructure details.
4. User sees available actions:
   - Retry.
   - Replace source file.
   - Cancel project.
   - Contact support or view details when appropriate.
5. Safe retries resume from the failed stage where possible.
6. Completed prior work is preserved.

## Cancel Flow

1. User selects **Cancel processing** from project actions.
2. Creator explains what will happen:
   - Active jobs stop where possible.
   - Uploaded source may remain unless deleted.
   - Generated partial results may remain.
3. User confirms.
4. Project becomes **Cancelled**.
5. User may archive, delete, or restart depending on available data.

## Dashboard Project Management Flow

- Open project.
- Retry failed project.
- Archive completed project.
- Delete draft or cancelled project with confirmation.
- Download approved project from quick action when available.

Destructive actions must use clear confirmation copy and never rely on hidden UI alone for authorization.
