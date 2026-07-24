-- 014_fewer_failures.sql
--
-- Make the pipeline self-healing so the "Creator couldn't finish" screen
-- almost never appears. Two changes:
--
-- 1) The attempt budget was 3. Worker restarts (every deploy!) consume an
--    attempt because the lease expires mid-run, so a handful of deploys plus
--    one real failure exhausted the budget and surfaced the failure screen.
--    Raise the default (and existing jobs) to 6 — with the render stall
--    watchdog, failed attempts are now cheap and bounded.
--
-- 2) release_job: a worker that is shutting down (deploy, scale-down) can
--    hand its running job back to the queue immediately WITHOUT burning an
--    attempt — the interruption is not the job's fault. Previously the job
--    stayed leased until the lease expired (up to 5 minutes of dead time)
--    and the re-claim consumed an attempt from the budget.

-- ── 1) Raise the attempt budget ───────────────────────────────────────────

alter table public.processing_jobs
  alter column max_attempts set default 6;

-- Give unfinished (and manually retryable) jobs the new budget too.
update public.processing_jobs
set max_attempts = 6
where max_attempts < 6
  and status in ('queued', 'leased', 'running', 'retry_scheduled', 'failed');

-- ── 2) release_job ────────────────────────────────────────────────────────

create or replace function public.release_job(
  p_job_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.processing_jobs;
begin
  select * into v_job
  from public.processing_jobs
  where id = p_job_id
    and status in ('running', 'leased')
    and lease_owner = p_worker_id
  for update;

  if not found then
    -- Someone else already reclaimed/settled it; nothing to release.
    return false;
  end if;

  update public.processing_jobs
  set status = 'queued',
      scheduled_at = now(),
      -- Refund the attempt consumed at claim time: the worker shutting down
      -- is an infrastructure event, not a failure of this job.
      attempt_count = greatest(v_job.attempt_count - 1, 0),
      lease_owner = null,
      lease_expires_at = null
  where id = v_job.id;

  return true;
end;
$$;

revoke all on function public.release_job(uuid, text) from public, anon, authenticated;
grant execute on function public.release_job(uuid, text) to service_role;
