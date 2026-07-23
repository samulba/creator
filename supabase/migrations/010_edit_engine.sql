-- Phase 8 foundation: edit engine data model.
--
-- The edit planner turns the selected story + script + candidate moments into
-- a structured, inspectable Edit Decision List (EDL). edit_versions holds the
-- plan (a jsonb EDL + summary); edit_segments is the normalized, queryable
-- form of that plan — one row per output segment, with its source range and
-- the narration/moment it carries.
--
-- The EDL is DETERMINISTIC (built from already-grounded data), so this stage
-- needs no AI provider. Creative intent lives here as enumerated edit_style
-- tokens; the render engine (Phase 9) executes the plan without re-deciding
-- anything creative.
--
-- Owner-scoped read-only RLS for authenticated; writes come from the worker
-- (service_role). Times are integer milliseconds. Purely additive. Requires
-- PostgreSQL 15+ for the column-list composite foreign key.

create type public.edit_status as enum (
  'pending',
  'planning',
  'ready',
  'failed'
);

create table public.edit_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  story_version_id uuid references public.story_versions(id) on delete set null,
  script_version_id uuid references public.script_versions(id) on delete set null,
  creative_settings_id uuid references public.project_creative_settings(id) on delete set null,
  version_number integer not null,
  status public.edit_status not null default 'pending',
  edl_schema_version integer not null default 1,
  timeline_duration_ms integer,
  summary text,
  edl jsonb not null default '{}'::jsonb,
  created_by_job_id uuid references public.processing_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edit_versions_version_number_positive check (version_number > 0),
  constraint edit_versions_edl_schema_version_valid check (edl_schema_version >= 1),
  constraint edit_versions_timeline_duration_non_negative check (timeline_duration_ms is null or timeline_duration_ms >= 0),
  constraint edit_versions_summary_length check (summary is null or char_length(summary) <= 4000),
  constraint edit_versions_edl_object check (jsonb_typeof(edl) = 'object'),
  constraint edit_versions_project_version_unique unique (project_id, version_number),
  constraint edit_versions_id_project_unique unique (id, project_id)
);

create index edit_versions_project_created_at_idx
  on public.edit_versions (project_id, created_at desc);

create table public.edit_segments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  edit_version_id uuid not null references public.edit_versions(id) on delete cascade,
  segment_index integer not null,
  segment_type text not null,
  output_start_ms integer not null,
  output_end_ms integer not null,
  source_asset_id uuid,
  source_start_ms integer,
  source_end_ms integer,
  candidate_moment_id uuid references public.candidate_moments(id) on delete set null,
  script_section_id uuid references public.script_sections(id) on delete set null,
  included boolean not null default true,
  effect_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edit_segments_segment_index_non_negative check (segment_index >= 0),
  constraint edit_segments_segment_type_length check (char_length(segment_type) between 1 and 40),
  constraint edit_segments_output_start_non_negative check (output_start_ms >= 0),
  constraint edit_segments_output_range_valid check (output_end_ms > output_start_ms),
  constraint edit_segments_source_range_valid check (
    (source_start_ms is null and source_end_ms is null)
    or (
      source_start_ms is not null and source_end_ms is not null
      and source_start_ms >= 0 and source_end_ms > source_start_ms
    )
  ),
  constraint edit_segments_effect_summary_length check (effect_summary is null or char_length(effect_summary) <= 1000),
  constraint edit_segments_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint edit_segments_version_index_unique unique (edit_version_id, segment_index),
  -- The source clip (when set) must belong to the same project.
  constraint edit_segments_source_asset_same_project_fkey
    foreign key (source_asset_id, project_id)
    references public.assets (id, project_id)
    on delete set null (source_asset_id)
);

create index edit_segments_project_idx on public.edit_segments (project_id);

create trigger edit_versions_set_updated_at
before update on public.edit_versions
for each row execute function public.set_updated_at();

create trigger edit_segments_set_updated_at
before update on public.edit_segments
for each row execute function public.set_updated_at();

alter table public.edit_versions enable row level security;
alter table public.edit_segments enable row level security;

create policy "edit_versions_select_own_project"
  on public.edit_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = edit_versions.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "edit_segments_select_own_project"
  on public.edit_segments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = edit_segments.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Explicit grants (default privileges are unreliable in this project; see 005).
grant select on public.edit_versions, public.edit_segments to authenticated;
grant all on public.edit_versions, public.edit_segments to service_role;

comment on table public.edit_versions is 'Inspectable Edit Decision List for a project. Deterministic (Phase 8); executed by the render engine.';
comment on table public.edit_segments is 'Normalized EDL: one row per output segment, with its source range and the moment/narration it carries.';
comment on column public.edit_versions.edl is 'Structured, versioned edit plan (edl_schema_version).';
comment on column public.edit_segments.effect_summary is 'Human-readable summary of enumerated edit_style effects applied to this segment.';
