-- Phase 0.3: Supabase Foundation for Creator.
-- Defines the minimum Auth + Projects schema with RLS.

create extension if not exists pgcrypto with schema extensions;

create type public.project_pipeline_state as enum (
  'draft',
  'uploading',
  'preparing',
  'understanding_gameplay',
  'building_story',
  'generating_voice',
  'building_edit',
  'rendering',
  'checking_quality',
  'ready_for_review',
  'approved',
  'failed',
  'cancelled',
  'archived',
  'deleting'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_language text not null default 'en',
  default_narrator_key text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 120),
  constraint profiles_default_language_length check (char_length(default_language) between 2 and 35),
  constraint profiles_preferences_object check (jsonb_typeof(preferences) = 'object')
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  description text,
  pipeline_state public.project_pipeline_state not null default 'draft',
  target_language text not null default 'en',
  failure_code text,
  failure_message text,
  archived_at timestamptz,
  delete_requested_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_length check (char_length(title) between 1 and 200),
  constraint projects_target_language_length check (char_length(target_language) between 2 and 35),
  constraint projects_deleted_after_requested check (deleted_at is null or delete_requested_at is not null),
  constraint projects_archived_state_consistency check (archived_at is null or pipeline_state = 'archived')
);

create table public.project_creative_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null,
  creative_direction text not null default 'balanced',
  pacing text not null default 'balanced',
  narration_density text not null default 'balanced',
  gameplay_preservation text not null default 'balanced',
  target_length text not null default 'auto',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint project_creative_settings_version_number_positive check (version_number > 0),
  constraint project_creative_settings_creative_direction_check check (creative_direction in ('balanced', 'funnier', 'more_dramatic', 'more_analytical')),
  constraint project_creative_settings_pacing_check check (pacing in ('relaxed', 'balanced', 'tight')),
  constraint project_creative_settings_narration_density_check check (narration_density in ('light', 'balanced', 'detailed')),
  constraint project_creative_settings_gameplay_preservation_check check (gameplay_preservation in ('preserve_more', 'balanced', 'cut_more_aggressively')),
  constraint project_creative_settings_target_length_check check (target_length in ('auto', 'shorter', 'standard', 'longer')),
  constraint project_creative_settings_project_version_unique unique (project_id, version_number)
);

create unique index project_creative_settings_one_active_per_project_idx
  on public.project_creative_settings(project_id)
  where is_active;

create index projects_user_updated_at_idx on public.projects(user_id, updated_at desc);
create index projects_user_pipeline_state_updated_at_idx on public.projects(user_id, pipeline_state, updated_at desc);
create index projects_active_user_updated_at_idx on public.projects(user_id, updated_at desc)
  where archived_at is null and deleted_at is null;
create index project_creative_settings_project_created_at_idx on public.project_creative_settings(project_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_creative_settings enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "projects_select_own_not_deleted"
  on public.projects
  for select
  to authenticated
  using (user_id = auth.uid() and deleted_at is null);

create policy "projects_insert_own"
  on public.projects
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "projects_update_own"
  on public.projects
  for update
  to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy "projects_delete_own"
  on public.projects
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "project_creative_settings_select_own_project"
  on public.project_creative_settings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_creative_settings.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "project_creative_settings_insert_own_project"
  on public.project_creative_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_creative_settings.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
    and (created_by is null or created_by = auth.uid())
  );

create policy "project_creative_settings_update_own_project"
  on public.project_creative_settings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_creative_settings.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_creative_settings.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
    and (created_by is null or created_by = auth.uid())
  );

create policy "project_creative_settings_delete_own_project"
  on public.project_creative_settings
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_creative_settings.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

comment on table public.profiles is 'Lightweight Creator user profile linked 1:1 to Supabase Auth users.';
comment on table public.projects is 'Creator project aggregate root for one long-form Dead by Daylight video workflow.';
comment on table public.project_creative_settings is 'Versioned Creative Director settings snapshots for a project.';
comment on column public.profiles.preferences is 'Small validated application preferences only; expected to remain an object.';
