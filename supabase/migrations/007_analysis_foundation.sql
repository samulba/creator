-- Phase 5 foundation: gameplay analysis data model.
--
-- Where the worker's AI analysis (Gemini, from Phase 5) writes its results:
-- one analysis_run per pass, the gameplay_events it detected, and the
-- candidate_moments selected for the story, plus the link between moments and
-- their supporting events.
--
-- All tables are project-child tables: owner-scoped read-only RLS for
-- authenticated (writes come from the worker via service_role, or later from
-- server-side RPCs for user actions like excluding a moment). Times are stored
-- as integer milliseconds. Purely additive.

create type public.analysis_run_status as enum (
  'pending',
  'running',
  'completed',
  'failed'
);

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_type text not null,
  status public.analysis_run_status not null default 'pending',
  source_asset_id uuid references public.assets(id) on delete restrict,
  proxy_asset_id uuid references public.assets(id) on delete restrict,
  summary text,
  model_metadata jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_runs_run_type_check check (run_type in ('coarse', 'deep', 'combined')),
  constraint analysis_runs_summary_length check (summary is null or char_length(summary) <= 4000),
  constraint analysis_runs_model_metadata_object check (jsonb_typeof(model_metadata) = 'object'),
  constraint analysis_runs_metrics_object check (jsonb_typeof(metrics) = 'object')
);

create index analysis_runs_project_created_at_idx
  on public.analysis_runs (project_id, created_at desc);
create index analysis_runs_project_status_idx
  on public.analysis_runs (project_id, status);

create table public.gameplay_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  event_type text not null,
  start_ms integer not null,
  end_ms integer not null,
  confidence numeric,
  importance_score numeric,
  title text,
  summary text,
  actor_labels jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gameplay_events_event_type_length check (char_length(event_type) between 1 and 80),
  constraint gameplay_events_start_ms_non_negative check (start_ms >= 0),
  constraint gameplay_events_range_valid check (end_ms > start_ms),
  constraint gameplay_events_confidence_range check (confidence is null or confidence between 0 and 1),
  constraint gameplay_events_importance_range check (importance_score is null or importance_score between 0 and 100),
  constraint gameplay_events_actor_labels_object check (jsonb_typeof(actor_labels) = 'object'),
  constraint gameplay_events_evidence_object check (jsonb_typeof(evidence) = 'object')
);

create index gameplay_events_project_start_idx
  on public.gameplay_events (project_id, start_ms);
create index gameplay_events_run_start_idx
  on public.gameplay_events (analysis_run_id, start_ms);
create index gameplay_events_project_type_idx
  on public.gameplay_events (project_id, event_type);

create table public.candidate_moments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  moment_type text not null,
  start_ms integer not null,
  end_ms integer not null,
  confidence numeric,
  importance_score numeric,
  title text,
  summary text,
  selection_reason text,
  inclusion_state text not null default 'candidate',
  excluded_by uuid references auth.users(id) on delete set null,
  excluded_at timestamptz,
  exclusion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_moments_moment_type_length check (char_length(moment_type) between 1 and 80),
  constraint candidate_moments_start_ms_non_negative check (start_ms >= 0),
  constraint candidate_moments_range_valid check (end_ms > start_ms),
  constraint candidate_moments_confidence_range check (confidence is null or confidence between 0 and 1),
  constraint candidate_moments_importance_range check (importance_score is null or importance_score between 0 and 100),
  constraint candidate_moments_inclusion_state_check check (inclusion_state in ('candidate', 'included', 'excluded', 'restored'))
);

create index candidate_moments_project_start_idx
  on public.candidate_moments (project_id, start_ms);
create index candidate_moments_project_importance_idx
  on public.candidate_moments (project_id, importance_score desc);
create index candidate_moments_run_idx
  on public.candidate_moments (analysis_run_id);

create table public.candidate_moment_events (
  candidate_moment_id uuid not null references public.candidate_moments(id) on delete cascade,
  gameplay_event_id uuid not null references public.gameplay_events(id) on delete cascade,
  relationship text not null default 'supports',
  created_at timestamptz not null default now(),
  primary key (candidate_moment_id, gameplay_event_id),
  constraint candidate_moment_events_relationship_length check (char_length(relationship) between 1 and 40)
);

create trigger analysis_runs_set_updated_at
before update on public.analysis_runs
for each row execute function public.set_updated_at();

create trigger gameplay_events_set_updated_at
before update on public.gameplay_events
for each row execute function public.set_updated_at();

create trigger candidate_moments_set_updated_at
before update on public.candidate_moments
for each row execute function public.set_updated_at();

-- RLS: owners may read their own project's analysis data. Writes come from the
-- worker (service_role, bypasses RLS) or later server-side RPCs.
alter table public.analysis_runs enable row level security;
alter table public.gameplay_events enable row level security;
alter table public.candidate_moments enable row level security;
alter table public.candidate_moment_events enable row level security;

create policy "analysis_runs_select_own_project"
  on public.analysis_runs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = analysis_runs.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "gameplay_events_select_own_project"
  on public.gameplay_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = gameplay_events.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "candidate_moments_select_own_project"
  on public.candidate_moments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = candidate_moments.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "candidate_moment_events_select_own_project"
  on public.candidate_moment_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.candidate_moments m
      join public.projects p on p.id = m.project_id
      where m.id = candidate_moment_events.candidate_moment_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Explicit grants (default privileges are unreliable in this project; see 005).
grant select on
  public.analysis_runs,
  public.gameplay_events,
  public.candidate_moments,
  public.candidate_moment_events
to authenticated;

grant all on
  public.analysis_runs,
  public.gameplay_events,
  public.candidate_moments,
  public.candidate_moment_events
to service_role;

comment on table public.analysis_runs is 'One gameplay analysis pass (coarse/deep). Written by the worker (Phase 5).';
comment on table public.gameplay_events is 'Detected match events grounded in the gameplay, per analysis run.';
comment on table public.candidate_moments is 'Moments selected as story candidates; users can exclude/restore via server RPCs.';
comment on table public.candidate_moment_events is 'Which gameplay events support each candidate moment.';
