-- Phase 3: Postgres-based background job system for Creator.
--
-- Durable asynchronous jobs (docs/JOB_DATA_MODEL.md) with atomic claiming
-- via FOR UPDATE SKIP LOCKED, leases for crash recovery, exponential retry
-- backoff, and idempotent enqueueing. No external queue technology.
--
-- Access model (docs/RLS_AUTHORIZATION_MODEL.md):
--   * Browsers/users never touch the base table. Direct access is revoked;
--     users read sanitized job state through the public_user_jobs view and
--     act only through the enqueue_job/retry_job RPCs, which validate
--     ownership internally.
--   * Workers (Phase 4) use the claim/start/heartbeat/complete/fail RPCs,
--     granted to service_role only.
--
-- Also adds assets.created_by_job_id, deferred from migration 003 because
-- it references this table. Purely additive.

create type public.job_type as enum (
  'source_validation',
  'media_probe',
  'proxy_generation',
  'coarse_analysis',
  'candidate_detection',
  'deep_analysis',
  'story_generation',
  'script_generation',
  'voice_generation',
  'edit_planning',
  'render',
  'quality_control',
  'asset_deletion'
);

create type public.job_status as enum (
  'queued',
  'leased',
  'running',
  'retry_scheduled',
  'succeeded',
  'failed',
  'cancelled'
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  job_type public.job_type not null,
  status public.job_status not null default 'queued',
  priority integer not null default 0,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  idempotency_key text not null,
  parent_job_id uuid references public.processing_jobs(id) on delete set null,
  scheduled_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  progress_percent integer,
  progress_stage text,
  current_activity text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  error_details jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processing_jobs_priority_range check (priority between -100 and 100),
  constraint processing_jobs_attempt_count_check check (attempt_count >= 0),
  constraint processing_jobs_max_attempts_check check (max_attempts >= 1),
  constraint processing_jobs_idempotency_key_length check (char_length(idempotency_key) between 1 and 200),
  constraint processing_jobs_progress_percent_range check (progress_percent is null or progress_percent between 0 and 100),
  constraint processing_jobs_progress_stage_length check (progress_stage is null or char_length(progress_stage) <= 200),
  constraint processing_jobs_current_activity_length check (current_activity is null or char_length(current_activity) <= 500),
  constraint processing_jobs_error_code_length check (error_code is null or char_length(error_code) <= 100),
  constraint processing_jobs_error_message_length check (error_message is null or char_length(error_message) <= 1000),
  constraint processing_jobs_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint processing_jobs_result_object check (jsonb_typeof(result) = 'object'),
  constraint processing_jobs_error_details_object check (jsonb_typeof(error_details) = 'object'),
  constraint processing_jobs_project_type_idempotency_unique unique (project_id, job_type, idempotency_key)
);

create index processing_jobs_claim_idx
  on public.processing_jobs (status, scheduled_at, priority desc);

create index processing_jobs_project_created_at_idx
  on public.processing_jobs (project_id, created_at desc);

create index processing_jobs_expired_lease_idx
  on public.processing_jobs (lease_expires_at)
  where status in ('leased', 'running');

create trigger processing_jobs_set_updated_at
before update on public.processing_jobs
for each row execute function public.set_updated_at();

-- Deferred from migration 003 (circular reference).
alter table public.assets
  add column created_by_job_id uuid references public.processing_jobs(id) on delete set null;

-- No direct user access to the base table: RLS on with no policies, and
-- grants revoked. Users read jobs only through public_user_jobs below.
alter table public.processing_jobs enable row level security;
revoke all on table public.processing_jobs from authenticated, anon;

-- Sanitized, owner-scoped job view. Runs with owner rights (security
-- invoker off) and filters by auth.uid() itself; payload, result,
-- error_details, lease and queue internals are never exposed.
create view public.public_user_jobs
with (security_invoker = off, security_barrier = true) as
select
  j.id,
  j.project_id,
  j.job_type,
  j.status,
  j.attempt_count,
  j.max_attempts,
  j.progress_percent,
  j.progress_stage,
  j.current_activity,
  j.error_code,
  j.error_message,
  j.scheduled_at,
  j.started_at,
  j.completed_at,
  j.created_at,
  j.updated_at
from public.processing_jobs j
where exists (
  select 1 from public.projects p
  where p.id = j.project_id
    and p.user_id = auth.uid()
    and p.deleted_at is null
);

revoke all on table public.public_user_jobs from public, anon;
grant select on public.public_user_jobs to authenticated;

-- ── User-facing RPCs (authenticated; ownership validated internally) ─────

-- Idempotent enqueue. Only job types that users may trigger directly are
-- allowed; pipeline-internal jobs are enqueued by workers in later phases.
create or replace function public.enqueue_job(
  p_project_id uuid,
  p_job_type public.job_type,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb,
  p_priority integer default 0,
  p_parent_job_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_job_type not in ('source_validation') then
    raise exception 'job type % cannot be enqueued directly', p_job_type;
  end if;

  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    raise exception 'invalid idempotency key';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object';
  end if;

  if p_priority is null or p_priority not between -100 and 100 then
    raise exception 'invalid priority';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.user_id = v_uid
      and p.deleted_at is null
  ) then
    raise exception 'project not found';
  end if;

  insert into public.processing_jobs
    (project_id, job_type, idempotency_key, payload, priority, parent_job_id)
  values
    (p_project_id, p_job_type, p_idempotency_key, p_payload, p_priority, p_parent_job_id)
  on conflict (project_id, job_type, idempotency_key) do nothing
  returning id into v_job_id;

  if v_job_id is null then
    select id into v_job_id
    from public.processing_jobs
    where project_id = p_project_id
      and job_type = p_job_type
      and idempotency_key = p_idempotency_key;
  end if;

  return v_job_id;
end;
$$;

-- Owner-initiated retry of a terminally failed job. Resets the attempt
-- budget and moves the project back into the stage the job belongs to.
create or replace function public.retry_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.processing_jobs;
  v_stage public.project_pipeline_state;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select j.* into v_job
  from public.processing_jobs j
  join public.projects p on p.id = j.project_id
  where j.id = p_job_id
    and p.user_id = v_uid
    and p.deleted_at is null
  for update of j;

  if not found then
    raise exception 'job not found';
  end if;

  if v_job.status <> 'failed' then
    raise exception 'only failed jobs can be retried';
  end if;

  update public.processing_jobs
  set status = 'queued',
      scheduled_at = now(),
      attempt_count = 0,
      lease_owner = null,
      lease_expires_at = null,
      completed_at = null
  where id = v_job.id;

  v_stage := case v_job.job_type
    when 'source_validation' then 'preparing'::public.project_pipeline_state
    when 'media_probe' then 'preparing'
    when 'proxy_generation' then 'preparing'
    when 'coarse_analysis' then 'understanding_gameplay'
    when 'candidate_detection' then 'understanding_gameplay'
    when 'deep_analysis' then 'understanding_gameplay'
    when 'story_generation' then 'building_story'
    when 'script_generation' then 'building_story'
    when 'voice_generation' then 'generating_voice'
    when 'edit_planning' then 'building_edit'
    when 'render' then 'rendering'
    when 'quality_control' then 'checking_quality'
    else null
  end;

  if v_stage is not null then
    update public.projects
    set pipeline_state = v_stage,
        failure_code = null,
        failure_message = null
    where id = v_job.project_id
      and pipeline_state = 'failed';
  end if;

  return true;
end;
$$;

-- ── Worker RPCs (service_role only; workers arrive in Phase 4) ───────────

-- Atomically claims the next eligible job: queued, due retries, or jobs
-- whose lease expired with attempts left.
create or replace function public.claim_next_job(
  p_worker_id text,
  p_job_types public.job_type[] default null,
  p_lease_seconds integer default 300
)
returns setof public.processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.processing_jobs;
begin
  if p_worker_id is null or char_length(p_worker_id) not between 1 and 200 then
    raise exception 'invalid worker id';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 30 and 3600 then
    raise exception 'invalid lease duration';
  end if;

  select * into v_job
  from public.processing_jobs j
  where (p_job_types is null or j.job_type = any (p_job_types))
    and j.scheduled_at <= now()
    and (
      j.status = 'queued'
      or (j.status = 'retry_scheduled')
      or (
        j.status in ('leased', 'running')
        and j.lease_expires_at is not null
        and j.lease_expires_at < now()
        and j.attempt_count < j.max_attempts
      )
    )
  order by j.priority desc, j.scheduled_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.processing_jobs
  set status = 'leased',
      lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where id = v_job.id
  returning * into v_job;

  return next v_job;
end;
$$;

create or replace function public.start_job(p_job_id uuid, p_worker_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.processing_jobs
  set status = 'running',
      attempt_count = attempt_count + 1,
      started_at = coalesce(started_at, now())
  where id = p_job_id
    and status = 'leased'
    and lease_owner = p_worker_id
    and lease_expires_at > now();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'job is not leased by this worker';
  end if;
  return true;
end;
$$;

create or replace function public.heartbeat_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 300,
  p_progress_percent integer default null,
  p_progress_stage text default null,
  p_current_activity text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_lease_seconds is null or p_lease_seconds not between 30 and 3600 then
    raise exception 'invalid lease duration';
  end if;

  update public.processing_jobs
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      progress_percent = coalesce(p_progress_percent, progress_percent),
      progress_stage = coalesce(p_progress_stage, progress_stage),
      current_activity = coalesce(p_current_activity, current_activity)
  where id = p_job_id
    and status = 'running'
    and lease_owner = p_worker_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'job is not running under this worker';
  end if;
  return true;
end;
$$;

create or replace function public.complete_job(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'result must be a JSON object';
  end if;

  update public.processing_jobs
  set status = 'succeeded',
      result = p_result,
      completed_at = now(),
      lease_owner = null,
      lease_expires_at = null,
      progress_percent = 100
  where id = p_job_id
    and status = 'running'
    and lease_owner = p_worker_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'job is not running under this worker';
  end if;
  return true;
end;
$$;

-- Retryable failures back off exponentially (30s * 2^attempt, capped at
-- 15 minutes). Terminal failures optionally mark the project failed with
-- the safe error fields.
create or replace function public.fail_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text,
  p_error_details jsonb default '{}'::jsonb,
  p_retryable boolean default true,
  p_fail_project boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.processing_jobs;
begin
  if p_error_code is null or char_length(p_error_code) not between 1 and 100 then
    raise exception 'invalid error code';
  end if;
  if p_error_details is null or jsonb_typeof(p_error_details) <> 'object' then
    raise exception 'error details must be a JSON object';
  end if;

  select * into v_job
  from public.processing_jobs
  where id = p_job_id
    and status in ('running', 'leased')
    and lease_owner = p_worker_id
  for update;

  if not found then
    raise exception 'job is not active under this worker';
  end if;

  if p_retryable and v_job.attempt_count < v_job.max_attempts then
    update public.processing_jobs
    set status = 'retry_scheduled',
        scheduled_at = now() + make_interval(
          secs => least(30 * power(2, v_job.attempt_count), 900)::integer
        ),
        error_code = p_error_code,
        error_message = p_error_message,
        error_details = p_error_details,
        lease_owner = null,
        lease_expires_at = null
    where id = v_job.id;
  else
    update public.processing_jobs
    set status = 'failed',
        completed_at = now(),
        error_code = p_error_code,
        error_message = p_error_message,
        error_details = p_error_details,
        lease_owner = null,
        lease_expires_at = null
    where id = v_job.id;

    if p_fail_project then
      update public.projects
      set pipeline_state = 'failed',
          failure_code = p_error_code,
          failure_message = p_error_message
      where id = v_job.project_id
        and deleted_at is null;
    end if;
  end if;

  return true;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────
-- Functions default to EXECUTE for PUBLIC; lock everything down first.

revoke all on function public.enqueue_job(uuid, public.job_type, text, jsonb, integer, uuid) from public, anon;
revoke all on function public.retry_job(uuid) from public, anon;
revoke all on function public.claim_next_job(text, public.job_type[], integer) from public, anon, authenticated;
revoke all on function public.start_job(uuid, text) from public, anon, authenticated;
revoke all on function public.heartbeat_job(uuid, text, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.complete_job(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_job(uuid, text, text, text, jsonb, boolean, boolean) from public, anon, authenticated;

grant execute on function public.enqueue_job(uuid, public.job_type, text, jsonb, integer, uuid) to authenticated;
grant execute on function public.retry_job(uuid) to authenticated;
grant execute on function public.claim_next_job(text, public.job_type[], integer) to service_role;
grant execute on function public.start_job(uuid, text) to service_role;
grant execute on function public.heartbeat_job(uuid, text, integer, integer, text, text) to service_role;
grant execute on function public.complete_job(uuid, text, jsonb) to service_role;
grant execute on function public.fail_job(uuid, text, text, text, jsonb, boolean, boolean) to service_role;

comment on table public.processing_jobs is 'Durable background jobs (Postgres queue). Claimed atomically with FOR UPDATE SKIP LOCKED via claim_next_job; users never access this table directly.';
comment on view public.public_user_jobs is 'Sanitized owner-scoped job state for the UI. Excludes payload, result, error_details, priority, idempotency and lease internals.';
comment on column public.processing_jobs.payload is 'Schema-validated worker input. Never secrets, signed URLs, or trusted ownership claims.';
comment on column public.processing_jobs.error_details is 'Support-only diagnostics; never exposed to the browser.';
comment on column public.assets.created_by_job_id is 'Job that produced this asset (generated assets, Phase 4+).';
