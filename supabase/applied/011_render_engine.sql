-- Phase 9 foundation: render engine data model.
--
-- output_versions is a produced version of the video (a specific
-- story+script+edit combination). render_attempts records each render run for
-- an output version (the FFmpeg job), so retries and technical metadata are
-- auditable. The qc_status enum is introduced here (output_versions.qc_status)
-- and reused by Phase 10's quality_checks.
--
-- Owner-scoped read-only RLS for authenticated; writes come from the worker
-- (service_role). Purely additive. Requires PostgreSQL 15+ for the
-- column-list composite foreign keys.

create type public.output_version_status as enum (
  'pending',
  'rendering',
  'rendered',
  'failed'
);

create type public.render_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed'
);

create type public.qc_status as enum (
  'not_started',
  'running',
  'passed',
  'failed',
  'skipped'
);

create table public.output_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null,
  status public.output_version_status not null default 'pending',
  story_version_id uuid references public.story_versions(id) on delete set null,
  script_version_id uuid references public.script_versions(id) on delete set null,
  edit_version_id uuid references public.edit_versions(id) on delete set null,
  creative_settings_id uuid references public.project_creative_settings(id) on delete set null,
  final_asset_id uuid,
  qc_status public.qc_status not null default 'not_started',
  is_current boolean not null default false,
  is_approved boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  change_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint output_versions_version_number_positive check (version_number > 0),
  constraint output_versions_change_summary_length check (change_summary is null or char_length(change_summary) <= 4000),
  constraint output_versions_approved_has_timestamp check (not is_approved or approved_at is not null),
  constraint output_versions_project_version_unique unique (project_id, version_number),
  constraint output_versions_id_project_unique unique (id, project_id),
  -- The final video (when set) must belong to the same project.
  constraint output_versions_final_asset_same_project_fkey
    foreign key (final_asset_id, project_id)
    references public.assets (id, project_id)
    on delete restrict
);

create unique index output_versions_one_current_per_project_idx
  on public.output_versions (project_id)
  where is_current;
create unique index output_versions_one_approved_per_project_idx
  on public.output_versions (project_id)
  where is_approved;
create index output_versions_project_created_at_idx
  on public.output_versions (project_id, created_at desc);

create table public.render_attempts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  output_version_id uuid not null references public.output_versions(id) on delete cascade,
  job_id uuid references public.processing_jobs(id) on delete set null,
  attempt_number integer not null,
  status public.render_status not null default 'queued',
  edit_version_id uuid references public.edit_versions(id) on delete set null,
  output_asset_id uuid,
  intermediate_asset_id uuid,
  technical_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint render_attempts_attempt_number_positive check (attempt_number > 0),
  constraint render_attempts_technical_metadata_object check (jsonb_typeof(technical_metadata) = 'object'),
  constraint render_attempts_error_code_length check (error_code is null or char_length(error_code) <= 100),
  constraint render_attempts_error_message_length check (error_message is null or char_length(error_message) <= 2000),
  constraint render_attempts_output_version_attempt_unique unique (output_version_id, attempt_number),
  constraint render_attempts_output_asset_same_project_fkey
    foreign key (output_asset_id, project_id)
    references public.assets (id, project_id)
    on delete restrict,
  constraint render_attempts_intermediate_asset_same_project_fkey
    foreign key (intermediate_asset_id, project_id)
    references public.assets (id, project_id)
    on delete restrict
);

create index render_attempts_project_created_at_idx
  on public.render_attempts (project_id, created_at desc);

create trigger output_versions_set_updated_at
before update on public.output_versions
for each row execute function public.set_updated_at();

create trigger render_attempts_set_updated_at
before update on public.render_attempts
for each row execute function public.set_updated_at();

alter table public.output_versions enable row level security;
alter table public.render_attempts enable row level security;

create policy "output_versions_select_own_project"
  on public.output_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = output_versions.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "render_attempts_select_own_project"
  on public.render_attempts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = render_attempts.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Explicit grants (default privileges are unreliable in this project; see 005).
grant select on public.output_versions, public.render_attempts to authenticated;
grant all on public.output_versions, public.render_attempts to service_role;

comment on table public.output_versions is 'A produced version of the video (a story+script+edit combination). Written by the worker (Phase 9).';
comment on table public.render_attempts is 'Each FFmpeg render run for an output version, with technical metadata for auditability.';
comment on column public.output_versions.qc_status is 'Quality control state (Phase 10); not_started until QC runs.';
