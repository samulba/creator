-- Phase 3 follow-up: explicit privileges for the `authenticated` role.
--
-- Supabase normally grants table access to `authenticated` automatically via
-- default privileges, but in some projects that does not apply to tables
-- created through SQL-editor migrations — leaving the app unable to read
-- channels, characters, assets, projects, etc. even though the tables exist
-- and RLS policies are in place (a query needs BOTH a table GRANT and a
-- passing RLS policy).
--
-- This migration grants the required privileges explicitly and idempotently.
-- RLS remains the real authorization gate. It deliberately does NOT grant the
-- processing_jobs base table or the worker RPCs — those stay service_role-only
-- (see migration 004).

grant usage on schema public to authenticated;

-- User-facing tables. RLS still restricts every row; these grants only lift
-- the table-level privilege check that default privileges should have set.
grant select, insert, update, delete on
  public.profiles,
  public.projects,
  public.project_creative_settings,
  public.channels,
  public.characters,
  public.assets
to authenticated;

-- Sanitized, owner-scoped job state (read-only view).
grant select on public.public_user_jobs to authenticated;

-- User-facing job RPCs only (worker RPCs remain service_role-only).
grant execute on function public.enqueue_job(uuid, public.job_type, text, jsonb, integer, uuid) to authenticated;
grant execute on function public.retry_job(uuid) to authenticated;

-- Refresh the PostgREST schema cache so the API sees the new grants.
notify pgrst, 'reload schema';
