-- 013_pipeline_reliability.sql
--
-- Two reliability fixes for the processing pipeline:
--
-- 1) Un-archiving previously force-reset pipeline_state to 'draft', losing
--    all pipeline progress (a rendered project came back claiming to be a
--    fresh draft). Store the state at archive time and restore it.
--
-- 2) A job whose lease expired on its final attempt was stuck in
--    'running'/'leased' forever: claim_next_job refuses it (attempt budget
--    spent) and nothing else ever touches it, so the project froze
--    mid-stage with no visible failure. claim_next_job now reaps such jobs
--    first — marking the job failed and surfacing the failure on the
--    project — before claiming new work.

-- ── 1) Pre-archive state ──────────────────────────────────────────────────

alter table public.projects
  add column if not exists pre_archive_state public.project_pipeline_state;

comment on column public.projects.pre_archive_state is
  'pipeline_state at the moment the project was archived; restored on unarchive.';

-- ── 2) Reap dead jobs inside claim_next_job ───────────────────────────────

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

  -- Reap: leases that expired with no attempts left can never be reclaimed
  -- or completed — settle them as failed and surface it on the project.
  with reaped as (
    update public.processing_jobs
    set status = 'failed',
        completed_at = now(),
        error_code = coalesce(error_code, 'LEASE_EXPIRED'),
        error_message = coalesce(
          error_message,
          'The worker processing this step stopped unexpectedly.'
        ),
        lease_owner = null,
        lease_expires_at = null
    where status in ('leased', 'running')
      and lease_expires_at is not null
      and lease_expires_at < now()
      and attempt_count >= max_attempts
    returning project_id
  )
  update public.projects p
  set pipeline_state = 'failed',
      failure_code = 'LEASE_EXPIRED',
      failure_message = 'A processing step stopped unexpectedly. Retry the failed step.'
  from reaped r
  where p.id = r.project_id
    and p.archived_at is null
    and p.deleted_at is null;

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
