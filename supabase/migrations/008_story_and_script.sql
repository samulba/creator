-- Phase 6 foundation: story engine + script data model.
--
-- Where the worker's story/script generation (Gemini, Phase 6) writes its
-- results. A project can have several story_versions (alternative narrative
-- angles); one is selected. The selected story drives one or more
-- script_versions, each broken into timestamp-aware script_sections.
--
-- Consistency (second freeze point, see docs/CHANNEL_CHARACTER_MODEL.md):
-- script_versions.narrator_config freezes the resolved character voice +
-- speech-style config at generation time, and generation_metadata records
-- model_id / prompt_template_version / character_config_hash / sampling
-- params. Later character edits never change an existing script version.
--
-- Owner-scoped read-only RLS for authenticated; writes come from the worker
-- (service_role) or later server-side RPCs. Times are integer milliseconds.
-- Purely additive. Requires PostgreSQL 15+ for the column-list ON DELETE
-- SET NULL form used by the composite foreign key.

create type public.story_status as enum (
  'pending',
  'generating',
  'generated',
  'failed'
);

create type public.script_status as enum (
  'pending',
  'generating',
  'generated',
  'failed'
);

create table public.story_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null,
  status public.story_status not null default 'pending',
  is_selected boolean not null default false,
  title text,
  angle text,
  summary text,
  structure jsonb not null default '{}'::jsonb,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_by_job_id uuid references public.processing_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_versions_version_number_positive check (version_number > 0),
  constraint story_versions_title_length check (title is null or char_length(title) between 1 and 300),
  constraint story_versions_angle_length check (angle is null or char_length(angle) <= 800),
  constraint story_versions_summary_length check (summary is null or char_length(summary) <= 4000),
  constraint story_versions_structure_object check (jsonb_typeof(structure) = 'object'),
  constraint story_versions_generation_metadata_object check (jsonb_typeof(generation_metadata) = 'object'),
  constraint story_versions_project_version_unique unique (project_id, version_number),
  constraint story_versions_id_project_unique unique (id, project_id)
);

create unique index story_versions_one_selected_per_project_idx
  on public.story_versions (project_id)
  where is_selected;
create index story_versions_project_created_at_idx
  on public.story_versions (project_id, created_at desc);

-- The project's chosen narrative angle. Composite FK guarantees the story
-- version belongs to the same project.
alter table public.projects
  add column selected_story_version_id uuid,
  add constraint projects_selected_story_same_project_fkey
    foreign key (selected_story_version_id, id)
    references public.story_versions (id, project_id)
    on delete set null (selected_story_version_id);

create table public.story_version_moments (
  story_version_id uuid not null references public.story_versions(id) on delete cascade,
  candidate_moment_id uuid not null references public.candidate_moments(id) on delete cascade,
  story_role text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (story_version_id, candidate_moment_id, story_role),
  constraint story_version_moments_role_length check (char_length(story_role) between 1 and 40),
  constraint story_version_moments_sort_order_non_negative check (sort_order >= 0)
);

create index story_version_moments_sort_idx
  on public.story_version_moments (story_version_id, sort_order);

create table public.script_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  story_version_id uuid references public.story_versions(id) on delete set null,
  creative_settings_id uuid references public.project_creative_settings(id) on delete set null,
  version_number integer not null,
  status public.script_status not null default 'pending',
  language text not null default 'en',
  character_id uuid references public.characters(id) on delete set null,
  narrator_config jsonb not null default '{}'::jsonb,
  full_text text,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_by_job_id uuid references public.processing_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint script_versions_version_number_positive check (version_number > 0),
  constraint script_versions_language_length check (char_length(language) between 2 and 35),
  constraint script_versions_full_text_length check (full_text is null or char_length(full_text) <= 200000),
  constraint script_versions_narrator_config_object check (jsonb_typeof(narrator_config) = 'object'),
  constraint script_versions_generation_metadata_object check (jsonb_typeof(generation_metadata) = 'object'),
  constraint script_versions_project_version_unique unique (project_id, version_number)
);

create index script_versions_story_idx on public.script_versions (story_version_id);
create index script_versions_project_created_at_idx
  on public.script_versions (project_id, created_at desc);

create table public.script_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  script_version_id uuid not null references public.script_versions(id) on delete cascade,
  section_index integer not null,
  start_ms integer not null,
  end_ms integer not null,
  beat_label text,
  text text not null,
  status text not null default 'active',
  parent_section_id uuid references public.script_sections(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint script_sections_section_index_non_negative check (section_index >= 0),
  constraint script_sections_start_ms_non_negative check (start_ms >= 0),
  constraint script_sections_range_valid check (end_ms > start_ms),
  constraint script_sections_beat_label_length check (beat_label is null or char_length(beat_label) between 1 and 120),
  constraint script_sections_text_length check (char_length(text) between 1 and 8000),
  constraint script_sections_status_check check (status in ('active', 'superseded', 'regenerating', 'failed')),
  constraint script_sections_version_index_unique unique (script_version_id, section_index)
);

create index script_sections_project_idx on public.script_sections (project_id);

create trigger story_versions_set_updated_at
before update on public.story_versions
for each row execute function public.set_updated_at();

create trigger script_versions_set_updated_at
before update on public.script_versions
for each row execute function public.set_updated_at();

create trigger script_sections_set_updated_at
before update on public.script_sections
for each row execute function public.set_updated_at();

-- RLS: owners may read their own project's story/script data. Writes come
-- from the worker (service_role, bypasses RLS) or later server-side RPCs.
alter table public.story_versions enable row level security;
alter table public.story_version_moments enable row level security;
alter table public.script_versions enable row level security;
alter table public.script_sections enable row level security;

create policy "story_versions_select_own_project"
  on public.story_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = story_versions.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "story_version_moments_select_own_project"
  on public.story_version_moments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.story_versions sv
      join public.projects p on p.id = sv.project_id
      where sv.id = story_version_moments.story_version_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "script_versions_select_own_project"
  on public.script_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = script_versions.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "script_sections_select_own_project"
  on public.script_sections
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = script_sections.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Explicit grants (default privileges are unreliable in this project; see 005).
grant select on
  public.story_versions,
  public.story_version_moments,
  public.script_versions,
  public.script_sections
to authenticated;

grant all on
  public.story_versions,
  public.story_version_moments,
  public.script_versions,
  public.script_sections
to service_role;

comment on table public.story_versions is 'Narrative angles for a project; one is selected. Written by the worker (Phase 6).';
comment on table public.story_version_moments is 'Which candidate moments a story version uses, and in what role/order.';
comment on table public.script_versions is 'Generated narration script; narrator_config freezes the resolved character config (second freeze point).';
comment on table public.script_sections is 'Timestamp-aware narration beats for a script version.';
comment on column public.projects.selected_story_version_id is 'The chosen narrative angle for this project.';
