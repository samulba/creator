-- Phase 7 foundation: narration (voice) data model.
--
-- One narration_assets row per script_section that gets voiced. The audio
-- bytes live in R2 as a `narration_audio` asset (assets table); this table
-- holds the voice-specific metadata and links the section to its audio.
--
-- Consistency: voice_config freezes the resolved ElevenLabs voice + settings
-- used for THIS narration (model id pinned per character — never a "latest"
-- alias), and generation_metadata records the provider request id, model id,
-- prompt/template version, and character_config_hash. Later character edits
-- never change an existing narration asset.
--
-- Owner-scoped read-only RLS for authenticated; writes come from the worker
-- (service_role). Purely additive. Requires PostgreSQL 15+ for the
-- column-list composite foreign key.

create table public.narration_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  script_section_id uuid not null references public.script_sections(id) on delete cascade,
  asset_id uuid,
  status text not null default 'pending',
  duration_ms integer,
  voice_provider text,
  voice_config jsonb not null default '{}'::jsonb,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_by_job_id uuid references public.processing_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint narration_assets_status_check check (status in ('pending', 'generating', 'available', 'failed', 'superseded')),
  constraint narration_assets_available_has_asset check (status <> 'available' or asset_id is not null),
  constraint narration_assets_duration_non_negative check (duration_ms is null or duration_ms >= 0),
  constraint narration_assets_voice_provider_length check (voice_provider is null or char_length(voice_provider) between 1 and 40),
  constraint narration_assets_voice_config_object check (jsonb_typeof(voice_config) = 'object'),
  constraint narration_assets_generation_metadata_object check (jsonb_typeof(generation_metadata) = 'object'),
  -- Composite FK: the audio asset (when set) must belong to the same project.
  -- MATCH SIMPLE means it is only enforced once asset_id is non-null.
  constraint narration_assets_asset_same_project_fkey
    foreign key (asset_id, project_id)
    references public.assets (id, project_id)
    on delete restrict
);

create index narration_assets_project_idx on public.narration_assets (project_id);
create index narration_assets_section_idx on public.narration_assets (script_section_id);

-- At most one live narration audio per script section.
create unique index narration_assets_one_available_per_section_idx
  on public.narration_assets (script_section_id)
  where status = 'available';

create trigger narration_assets_set_updated_at
before update on public.narration_assets
for each row execute function public.set_updated_at();

alter table public.narration_assets enable row level security;

create policy "narration_assets_select_own_project"
  on public.narration_assets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = narration_assets.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

grant select on public.narration_assets to authenticated;
grant all on public.narration_assets to service_role;

comment on table public.narration_assets is 'Voice-specific metadata linking a script section to its narration audio asset. Written by the worker (Phase 7).';
comment on column public.narration_assets.voice_config is 'Frozen resolved voice config (voice_key + pinned model + settings) used for this narration.';
comment on column public.narration_assets.generation_metadata is 'model_id, prompt_template_version, character_config_hash, provider request id, sampling params.';
