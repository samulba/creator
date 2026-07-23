-- Phase 4 follow-up: explicit privileges for the `service_role`.
--
-- The video worker connects with the Supabase service_role key. service_role
-- bypasses RLS, but bypassing RLS is not the same as holding table GRANTs —
-- and this project's default privileges did not apply to the migration-created
-- tables (the same gap migration 005 fixed for `authenticated`). Without this,
-- the worker's direct reads/writes on processing_jobs, assets, and projects
-- would fail with "permission denied".
--
-- This grants service_role full access to current and future public tables,
-- which matches Supabase's intended setup for the trusted backend role. RLS is
-- irrelevant to service_role; the security boundary is that the service_role
-- key lives only in the worker environment, never in the browser.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all routines in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on routines to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
