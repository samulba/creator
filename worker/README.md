# Creator Video Worker

A standalone service that runs the heavy media work **outside** Vercel. It
polls the Postgres job queue (migration 004), claims jobs atomically, and
processes them with FFprobe/FFmpeg. It has no inbound HTTP surface — it only
talks to Supabase and Cloudflare R2.

## What it does (Phases 4–5)

| Job | Work | Next |
| --- | --- | --- |
| `source_validation` | Confirms the uploaded object exists in R2 and matches the recorded size | → `media_probe` |
| `media_probe` | FFprobe over a presigned URL → writes duration, resolution, frame rate, codecs onto the source asset | → `proxy_generation` |
| `proxy_generation` | FFmpeg downscales the source to a 720p analysis proxy, uploads it to R2 as a `proxy_video` asset, advances the project to **understanding_gameplay** | → `coarse_analysis` |
| `coarse_analysis` | Sends the proxy to Gemini, validates the structured result, and writes `analysis_runs` + `gameplay_events` + `candidate_moments` (migration 007) | → `deep_analysis` (handled from Phase 6) |

`coarse_analysis` runs **only when `GEMINI_API_KEY` is set** (see below). If it
is not set, the worker does not claim `coarse_analysis` jobs and the pipeline
pauses at **understanding_gameplay** — the job stays queued rather than
failing. After a successful pass the project waits on `deep_analysis`, whose
handler arrives in a later phase; until then that job stays queued (expected).

The worker never downloads multi-GB sources just to read them: FFprobe and
FFmpeg read the presigned URL directly over HTTP range requests. Only the
generated proxy is written to local temp storage, and it is cleaned up after
upload (even on failure). Coarse analysis reads the small proxy (not the
original), uploads it to the Gemini File API, and deletes it from Gemini when
the pass finishes.

## Gemini analysis (Phase 5)

`coarse_analysis` is the first real AI step. It is built against the Gemini
**File API** + `generateContent` with a strict `responseSchema`, using the
global `fetch` in Node 22 (no SDK dependency). The provider boundary lives in
`src/ai/` so a different model/vendor can be swapped in behind the
`AnalysisProvider` interface without touching the job handler.

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

**Honest testing boundary.** The schema validation, persona/prompt assembly,
config hashing, and DB mapping are covered by `npm test`
(`src/ai/schema.test.ts`, 14 cases). The live Gemini HTTP calls in
`src/ai/gemini.ts` cannot be exercised without a real, funded `GEMINI_API_KEY`,
so they are **not** covered by automated tests — the request/response shapes
are written to Google's documented REST contract, and the first run against a
real key is the true integration test. Transient failures (429/5xx, timeouts)
retry with the queue's exponential backoff; malformed or empty responses fail
the run with a clear code and are recorded on the `analysis_runs` row.

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
| `GEMINI_API_KEY` | no | Google AI Studio key. **Secret.** Enables `coarse_analysis`; absent → those jobs stay queued. |
| `GEMINI_MODEL` | no | Video-capable Gemini model (default `gemini-2.5-flash`) |
| `WORKER_NAME` | no | Label prefix for this worker (default `creator-worker`) |
| `WORKER_LEASE_SECONDS` | no | Job lease length (default 300) |
| `WORKER_POLL_INTERVAL_MS` | no | Idle poll interval (default 4000) |
| `WORKER_PROXY_HEIGHT` | no | Proxy height in px (default 720) |
| `GEMINI_FILE_TIMEOUT_MS` | no | Max wait for uploaded footage to become ACTIVE (default 300000) |
| `GEMINI_REQUEST_TIMEOUT_MS` | no | Per-request timeout for Gemini calls (default 600000) |

The `SUPABASE_SERVICE_ROLE_KEY` (Phase 4) and `GEMINI_API_KEY` (Phase 5) are
the server-side secrets this worker introduces. Both are different from the
publishable/anon key the web app uses, and must live only in the worker's
environment — never in a browser bundle.

> **Migration 007 must be applied first.** `coarse_analysis` writes into
> `analysis_runs`, `gameplay_events`, and `candidate_moments`. Apply
> `supabase/migrations/007_analysis_foundation.sql` (and `006` for the
> service_role grants) before starting a worker with a Gemini key.

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
5. **With `GEMINI_API_KEY` set** (and migration 007 applied): the worker logs
   `job started` for `coarse_analysis`, and on success an `analysis_runs` row
   (status `completed`) plus `gameplay_events` and `candidate_moments` rows
   appear for the project. The project then waits on `deep_analysis` (Phase 6).
   **Without the key**: `coarse_analysis` stays queued and the project stays on
   *Understanding gameplay* — expected, not an error.
