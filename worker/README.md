# Creator Video Worker

A standalone service that runs the heavy media work **outside** Vercel. It
polls the Postgres job queue (migration 004), claims jobs atomically, and
processes them with FFprobe/FFmpeg. It has no inbound HTTP surface — it only
talks to Supabase and Cloudflare R2.

## What it does (Phases 4–9)

| Job | Work | Next |
| --- | --- | --- |
| `source_validation` | Confirms the uploaded object exists in R2 and matches the recorded size | → `media_probe` |
| `media_probe` | FFprobe over a presigned URL → writes duration, resolution, frame rate, codecs onto the source asset | → `proxy_generation` |
| `proxy_generation` | FFmpeg downscales the source to a 720p analysis proxy, uploads it to R2 as a `proxy_video` asset, advances to **understanding_gameplay** | → `coarse_analysis` |
| `coarse_analysis` | Sends the proxy to Gemini, validates the structured result, writes `analysis_runs` + `gameplay_events` + `candidate_moments` (007) | → `story_generation` |
| `story_generation` | Gemini chooses the narrative angle + moments; writes a selected `story_versions` + `story_version_moments` (008), advances to **building_story** | → `script_generation` |
| `script_generation` | Gemini writes timestamp-aware narration; writes `script_versions` (frozen `narrator_config`) + `script_sections`; enforces `forbidden_words` | → `voice_generation` |
| `voice_generation` | ElevenLabs narrates each section; stores `narration_audio` assets + `narration_assets` rows (009), advances to **building_edit** | → `edit_planning` |
| `edit_planning` | Deterministic EDL from the story beats + source ranges + `edit_style` tokens; writes `edit_versions` + `edit_segments` (010) | → `render` |
| `render` | FFmpeg cuts the segments, concatenates, overlays ducked narration, encodes the final MP4 → `final_video` asset + `output_versions`/`render_attempts` (011), advances to **checking_quality** | → `quality_control` (Phase 10) |

`coarse_analysis` / `story_generation` / `script_generation` run **only when
`GEMINI_API_KEY` is set**; `voice_generation` runs **only when
`ELEVENLABS_API_KEY` is set**. `edit_planning` and `render` are FFmpeg-only and
**always run** (no external key). When a key is absent the worker does not claim
the matching jobs and the pipeline pauses (job stays queued) rather than
failing. After rendering, the project waits on `quality_control` (Phase 10);
until then that job stays queued (expected).

A deeper per-moment analysis pass (`deep_analysis`) is a planned refinement
that can be inserted between coarse analysis and story generation later; the
current mainline goes coarse → story directly.

The worker never downloads multi-GB sources just to read them: FFprobe and
FFmpeg read the presigned URL directly over HTTP range requests. Only the
generated proxy is written to local temp storage, and it is cleaned up after
upload (even on failure). Coarse analysis reads the small proxy (not the
original), uploads it to the Gemini File API, and deletes it from Gemini when
the pass finishes.

## AI pipeline (Phases 5–7)

All AI work sits behind provider interfaces in `src/ai/` (`GenerativeProvider`
for Gemini analysis/story/script, `VoiceProvider` for ElevenLabs), so a
different model/vendor can be swapped in without touching the job handlers.
Everything is built against the documented REST APIs with the global `fetch`
in Node 22 — no SDK dependencies.

- **coarse_analysis** — Gemini **File API** upload + `generateContent` with a
  strict `responseSchema`; detects grounded gameplay events + candidate moments.
- **story_generation** — Gemini text call that picks the narrative angle and
  the moments that carry it (grounded in the analysis, not the raw video).
- **script_generation** — Gemini text call that writes timestamp-aware
  narration in the character's voice. `example_lines` are the primary style
  anchor; `forbidden_words` are enforced hard (a violation fails the job and
  retries); catchphrase usage is recorded as a soft budget. The resolved
  character config is frozen into `script_versions.narrator_config`.
- **voice_generation** — ElevenLabs TTS per section, with the model **pinned**
  per character (never a "latest" alias). A missing/deleted provider voice is a
  first-class, non-retryable failure (`VOICE_MISSING`); a narrator with no voice
  configured fails clearly with `VOICE_NOT_CONFIGURED`.

**Consistency provenance.** Each run stamps `analysis_runs.model_metadata`
with the provider id, model id, `prompt_template_version`, the resolved
`character_id`, and a `character_config_hash` — so a video always traces back
to the exact narrator persona and model it was built from. This is part of the
per-channel consistency model (see `docs/CHANNEL_CHARACTER_MODEL.md`).

**Grounding.** The prompt instructs the model to report only what is visibly
on screen and never fabricate events; the creative dials and persona bias
*which* moments matter and how titles are framed, not the facts. Every field
of the response is re-validated and clamped to the database constraints in
`src/ai/schema.ts` — provider output is treated as data, never trusted blindly.

**Honest testing boundary.** The schema validators, persona/story/script
prompt assembly, config hashing, forbidden-word enforcement, voice-config
resolution, request-body building, and the EDL builder are all covered by
`npm test` (`src/ai/*.test.ts` + `src/edit/edl.test.ts`, 34 cases). The live
**HTTP calls** to Gemini and ElevenLabs cannot be exercised without real,
funded keys, so they are **not** covered by automated tests — the
request/response shapes are written to each vendor's documented REST contract,
and the first run against real keys is the true integration test. Transient
failures (429/5xx, timeouts) retry with the queue's exponential backoff;
malformed, empty, or blocked responses fail with a clear code and are recorded
on the relevant version/run row.

## Edit + render (Phases 8–9)

`edit_planning` builds a **deterministic** Edit Decision List — no AI provider —
so it always runs (see `src/edit/edl.ts`). It turns the selected story's ordered
beats + their candidate source ranges + the script sections + the channel's
enumerated `edit_style` tokens into contiguous `edit_segments`, capping per-clip
length by the `gameplay_preservation` dial.

`render` executes the EDL with FFmpeg (`src/render/ffmpeg-render.ts`): cut each
segment from the source (input-seek + re-encode to a uniform 1080p/30fps),
concatenate (concat demuxer, stream copy), build a narration track positioned on
the output timeline (`adelay` + `amix`), duck the gameplay audio under narration
(`sidechaincompress`), and encode a faststart MP4 → a `final_video` asset. It is
then re-probed for a readable video stream, audio stream, and positive duration
(9.2). Narration is best-effort: with no narration assets, a valid
gameplay-only video is produced.

**Deferred (documented, not faked):** basic zooms and burned-in captions are not
implemented in the v1 render — the `edit_style` tokens for them are recorded in
the EDL but not yet applied by FFmpeg. The render pipeline's filter graphs were
smoke-tested locally on generated media (the exact commands the worker runs);
the full end-to-end render on a real source needs live data and is not covered
by automated tests.

## Job lifecycle & safety

- Jobs are claimed with `claim_next_job` (`FOR UPDATE SKIP LOCKED`), so
  multiple worker instances never process the same job.
- The lease is renewed via `heartbeat_job`; if a worker dies, another
  reclaims the job after the lease expires.
- Failures use `fail_job`: retryable failures back off exponentially
  (30s·2ⁿ, capped at 15 min); terminal failures mark the project failed with
  a safe message. Completed prior work is preserved.
- FFprobe/FFmpeg are invoked with explicit argument arrays (never a shell
  string), so URLs and object keys can't be interpreted as shell syntax.

## Environment variables

All server-side secrets. **Never** expose these in the web app or a browser.

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes | `https://<ref>.supabase.co` (same project as the web app) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase Dashboard → Settings → API → **service_role** key. **Secret.** Bypasses RLS — worker only. |
| `R2_ACCOUNT_ID` | yes | Same Cloudflare account/bucket as the web app |
| `R2_ACCESS_KEY_ID` | yes | R2 API token (Object Read & Write) |
| `R2_SECRET_ACCESS_KEY` | yes | R2 API token secret |
| `R2_BUCKET` | yes | e.g. `creator-media` |
| `GEMINI_API_KEY` | no | Google AI Studio key. **Secret.** Enables `coarse_analysis` / `story_generation` / `script_generation`; absent → those jobs stay queued. |
| `GEMINI_MODEL` | no | Video- and text-capable Gemini model (default `gemini-3.5-flash`) |
| `ELEVENLABS_API_KEY` | no | ElevenLabs key. **Secret.** Enables `voice_generation`; absent → those jobs stay queued. |
| `ELEVENLABS_MODEL` | no | Pinned fallback model id, never "latest" (default `eleven_multilingual_v2`) |
| `ELEVENLABS_OUTPUT_FORMAT` | no | Audio output format (default `mp3_44100_128`) |
| `WORKER_NAME` | no | Label prefix for this worker (default `creator-worker`) |
| `WORKER_LEASE_SECONDS` | no | Job lease length (default 300) |
| `WORKER_POLL_INTERVAL_MS` | no | Idle poll interval (default 4000) |
| `WORKER_PROXY_HEIGHT` | no | Proxy height in px (default 720) |
| `WORKER_RENDER_HEIGHT` | no | Final render height in px (default 1080) |
| `WORKER_RENDER_FPS` | no | Final render frame rate (default 30) |
| `GEMINI_FILE_TIMEOUT_MS` | no | Max wait for uploaded footage to become ACTIVE (default 300000) |
| `GEMINI_REQUEST_TIMEOUT_MS` | no | Per-request timeout for Gemini calls (default 600000) |
| `ELEVENLABS_REQUEST_TIMEOUT_MS` | no | Per-request timeout for voice calls (default 300000) |

The `SUPABASE_SERVICE_ROLE_KEY` (Phase 4), `GEMINI_API_KEY` (Phases 5–6), and
`ELEVENLABS_API_KEY` (Phase 7) are the server-side secrets this worker
introduces. All are different from the publishable/anon key the web app uses,
and must live only in the worker's environment — never in a browser bundle.

> **Migrations must be applied first.** `coarse_analysis` needs migration 007;
> `story_generation`/`script_generation` need 008; `voice_generation` needs
> 009. Apply `006` (service_role grants) and `007`–`009` before starting a
> worker with the AI keys.

## Run locally

```bash
cd worker
npm install
cp .env.example .env   # fill in the values (see table above)
# load .env into your shell, then:
npm run dev
```

Requires FFmpeg/FFprobe on the PATH (the Docker image installs them).

Run the unit tests (schema validation, persona/prompt assembly, config hash):

```bash
npm test
```

## Deploy (Docker)

The worker ships as a Docker image (`worker/Dockerfile`) that bundles
FFmpeg. It cannot run on Vercel (long-running, needs FFmpeg binaries). Any
container host works; the simplest options:

### Railway
1. New Project → **Deploy from GitHub repo** → pick this repo.
2. Set the service **Root Directory** to `worker` and it will use the
   Dockerfile automatically.
3. Add the environment variables from the table above.
4. Deploy. No public domain / port is needed — it's a background worker.

### Fly.io
```bash
cd worker
fly launch --no-deploy          # generates fly.toml; remove the [http_service] block
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... R2_ACCOUNT_ID=... \
  R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=...
fly deploy
```

### Render
New → **Background Worker** → connect the repo → Root Directory `worker`,
Runtime **Docker** → add the environment variables → create.

## Verify it works

1. Upload a gameplay recording in the web app (project moves to
   **Preparing**, a `source_validation` job is queued).
2. Start the worker. Its logs (structured JSON) should show
   `job started` → `job succeeded` for `source_validation`, then
   `media_probe`, then `proxy_generation`.
3. In the web app the project advances through *Preparing footage* and lands
   on **Understanding gameplay**.
4. In R2, a `proxy.mp4` appears alongside the source under
   `.../assets/<proxy-id>/proxy.mp4`, and the source asset row now has
   `duration_ms`, `width`, `height`, and codec fields populated.
5. **With `GEMINI_API_KEY` set** (migrations 007–008 applied): the worker runs
   `coarse_analysis` (writes `analysis_runs` + `gameplay_events` +
   `candidate_moments`), then `story_generation` (a selected `story_versions`
   row + `story_version_moments`, project → *Building story*), then
   `script_generation` (`script_versions` with frozen `narrator_config` +
   `script_sections`). **Without the key** the project stays on *Understanding
   gameplay* — expected, not an error.
6. **With `ELEVENLABS_API_KEY` set** (migration 009 applied, and the project's
   character has a `voice_key`): `voice_generation` narrates each section →
   `narration_audio` assets in R2 + `narration_assets` rows, project →
   *Building edit*. **Without the key** the project stays on *Generating voice* —
   expected. A character with no voice fails clearly with `VOICE_NOT_CONFIGURED`.
7. **Edit + render (no key needed, migrations 010–011 applied):**
   `edit_planning` writes an `edit_versions` row + `edit_segments`, then `render`
   produces a `final_video` asset in R2 with an `output_versions` (status
   `rendered`, `is_current`) + a succeeded `render_attempts` row. The project
   advances to *Checking quality* and waits on `quality_control` (Phase 10).
