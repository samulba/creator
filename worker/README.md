# Creator Video Worker

A standalone service that runs the heavy media work **outside** Vercel. It
polls the Postgres job queue (migration 004), claims jobs atomically, and
processes them with FFprobe/FFmpeg. It has no inbound HTTP surface — it only
talks to Supabase and Cloudflare R2.

## What it does (Phase 4)

| Job | Work | Next |
| --- | --- | --- |
| `source_validation` | Confirms the uploaded object exists in R2 and matches the recorded size | → `media_probe` |
| `media_probe` | FFprobe over a presigned URL → writes duration, resolution, frame rate, codecs onto the source asset | → `proxy_generation` |
| `proxy_generation` | FFmpeg downscales the source to a 720p analysis proxy, uploads it to R2 as a `proxy_video` asset, advances the project to **understanding_gameplay** | → `coarse_analysis` (handled from Phase 5) |

After proxy generation the project waits on `coarse_analysis`, which needs
the AI provider integration (Phase 5). Until that worker exists the job
stays queued — this is expected.

The worker never downloads multi-GB sources just to read them: FFprobe and
FFmpeg read the presigned URL directly over HTTP range requests. Only the
generated proxy is written to local temp storage, and it is cleaned up after
upload (even on failure).

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
| `WORKER_NAME` | no | Label prefix for this worker (default `creator-worker`) |
| `WORKER_LEASE_SECONDS` | no | Job lease length (default 300) |
| `WORKER_POLL_INTERVAL_MS` | no | Idle poll interval (default 4000) |
| `WORKER_PROXY_HEIGHT` | no | Proxy height in px (default 720) |

The `SUPABASE_SERVICE_ROLE_KEY` is the one genuinely new secret this phase
introduces. It is different from the publishable/anon key the web app uses —
it bypasses RLS and must live only in the worker's environment.

## Run locally

```bash
cd worker
npm install
cp .env.example .env   # fill in the values (see table above)
# load .env into your shell, then:
npm run dev
```

Requires FFmpeg/FFprobe on the PATH (the Docker image installs them).

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
   on **Understanding gameplay** (then waits for Phase 5).
4. In R2, a `proxy.mp4` appears alongside the source under
   `.../assets/<proxy-id>/proxy.mp4`, and the source asset row now has
   `duration_ms`, `width`, `height`, and codec fields populated.
