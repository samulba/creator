# Creator — Asset Data Model

## Purpose

Creator handles large private media files and generated artifacts. Cloudflare R2 stores binary objects. Postgres stores asset metadata, ownership, status, technical media data, and lifecycle state.

## Core Table

The MVP asset table is `assets`.

A single generic asset table is appropriate because original videos, proxies, audio files, rendered outputs, and intermediate artifacts all need the same security and lifecycle treatment. Specialized tables such as `narration_assets` and `render_attempts` reference `assets` when they need domain-specific metadata.

## Asset Types

Recommended `asset_type` values:

- `original_source` — unmodified uploaded gameplay. Never overwrite.
- `proxy_video` — lower-cost analysis video.
- `extracted_audio` — extracted game/audio track for analysis or mix support.
- `frame_samples` — image samples or manifest object used for analysis.
- `narration_audio` — generated voiceover audio.
- `intermediate_render` — temporary or reusable render artifact.
- `final_video` — user-reviewable rendered output.
- `captions` — generated captions/subtitles file when supported.
- `preview_image` — thumbnails/stills for UI preview when supported.

## Asset Statuses

Recommended `asset_status` values:

- `pending` — row exists before object upload/write begins
- `uploading` — upload is in progress
- `available` — object exists and passed required verification
- `failed` — upload or generation failed
- `delete_pending` — deletion requested, object may still exist
- `deleted` — object removed or tombstoned

Only server/worker code should mark an asset `available` after verifying object existence and metadata.

## Storage References

Store:

- `storage_provider` (`r2` for MVP)
- `bucket`
- `object_key`

Do not store public URLs. Do not store signed URLs. Signed access must be generated server-side after authorization checks.

Recommended object key pattern:

```text
{environment}/users/{user_id}/projects/{project_id}/assets/{asset_id}/{generated_file_name}
```

The final path component should be server-generated. A sanitized display filename can be included but must not be trusted for command execution or path construction.

## Metadata Fields

Use typed columns for common query/display fields:

- original filename
- content type
- byte size
- SHA-256 checksum
- duration in milliseconds
- width
- height
- frame rate
- video codec
- audio codec

Use `metadata jsonb` for bounded extra details, such as:

- FFprobe stream details
- audio channel count
- bitrate
- sample rate
- frame sample manifest
- provider generation metadata
- render encoding settings

## Original Source Asset Rules

- One active original source asset per project in MVP.
- The original source must never be modified or overwritten.
- Final rendering should use the original source where possible, not the analysis proxy.
- Source validation and media probe jobs update metadata but do not alter the source object.
- If a user replaces source footage in a future workflow, preserve prior records or require a new project; do not silently mutate historical output lineage.

## Generated Asset Rules

Generated assets should be associated with the job or domain record that created them:

- proxy video from proxy generation job
- narration audio from `narration_assets`
- final video from `render_attempts` and `output_versions`
- QC preview artifacts from `quality_checks` if later needed

Generated asset keys should avoid collisions. Prefer deterministic keys containing asset id and attempt/version identifiers.

## Upload Flow

1. Server validates authenticated project ownership.
2. Server creates `assets` row with `asset_type = 'original_source'`, status `pending` or `uploading`, and a server-generated R2 key.
3. Server returns signed upload instructions.
4. Browser uploads directly to R2.
5. Browser notifies server upload is complete.
6. Server verifies object exists, byte size, content type where available, and checksum where supported.
7. Server sets asset status `available` and enqueues source validation.

Large files should not be routed through normal Vercel request handlers.

## Download and Preview Flow

1. Client requests access to an asset or output version.
2. Server authenticates the user.
3. Server verifies the asset belongs to a project owned by that user and is `available`.
4. Server creates a short-lived signed R2 URL.
5. Client uses the signed URL for preview/download.

## Deletion Lifecycle

Asset deletion is asynchronous to avoid database/storage inconsistencies.

1. Project or asset deletion is requested.
2. Asset status becomes `delete_pending` with `delete_requested_at`.
3. `asset_deletion` job removes the R2 object or verifies it no longer exists.
4. Asset status becomes `deleted` with `deleted_at`.
5. Project deletion can complete after all required asset cleanup jobs finish.

Missing R2 objects during deletion may be treated as successful cleanup only after verification. Do not hard-delete asset rows before cleanup because they are the storage deletion manifest.

## RLS and Asset Security

Users can read metadata for assets in their own projects. They cannot directly write generated asset rows or storage references from the browser.

RLS protects database rows, not R2 objects. All object access must be mediated by server-side signed URLs.

## Untrusted Media Handling

- Treat every upload as untrusted until validated.
- Do not trust file extensions or MIME type alone.
- Avoid using user filenames in shell commands.
- Workers should invoke FFmpeg/FFprobe with argument arrays, not concatenated shell strings.
- Temporary worker files should be isolated per job and cleaned safely.

## Asset Relationships

```text
projects
  └── assets
        ├── original_source used by analysis/renders
        ├── proxy_video used by analysis_runs
        ├── narration_audio referenced by narration_assets
        ├── intermediate_render referenced by render_attempts
        └── final_video referenced by output_versions
```

## Future Asset Concepts Not in MVP

Do not implement yet unless separately approved:

- public sharing assets
- CDN-public derivatives
- team-owned storage namespaces
- multi-game asset catalogs
- social publishing export records
- long-term cold storage tier automation
