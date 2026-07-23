-- Phase 1.5: Channels & Characters for Creator.
--
-- Introduces per-channel consistency as a first-class concept:
--   characters — reusable narrator identities (voice + speech style),
--                a user-level library shared across channels.
--   channels   — the user's YouTube channels with creative defaults and
--                edit-style branding.
--
-- Consistency model (two freeze points, see docs/CHANNEL_CHARACTER_MODEL.md):
--   1. Project creation copies the channel's creative dials + edit_style
--      BY VALUE into project_creative_settings; the character is stored
--      BY REFERENCE so character fixes flow into not-yet-generated videos.
--   2. Generation (Phase 6/7) freezes the resolved character config into
--      version rows so later character edits never change existing videos.
--
-- Purely additive. Requires PostgreSQL 15+ for the column-list form of
-- ON DELETE SET NULL used by the composite foreign keys.

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  language text not null default 'en',
  voice_provider text not null default 'elevenlabs',
  voice_key text,
  voice_settings jsonb not null default '{}'::jsonb,
  speech_style jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint characters_name_length check (char_length(name) between 1 and 120),
  constraint characters_description_length check (description is null or char_length(description) <= 2000),
  constraint characters_language_length check (char_length(language) between 2 and 35),
  constraint characters_voice_provider_check check (voice_provider in ('elevenlabs')),
  constraint characters_voice_key_length check (voice_key is null or char_length(voice_key) between 1 and 200),
  constraint characters_voice_settings_object check (jsonb_typeof(voice_settings) = 'object'),
  constraint characters_speech_style_object check (jsonb_typeof(speech_style) = 'object'),
  constraint characters_id_user_unique unique (id, user_id)
);

create unique index characters_user_name_active_unique_idx
  on public.characters (user_id, lower(name))
  where archived_at is null;

create index characters_user_id_idx on public.characters (user_id);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  youtube_handle text,
  description text,
  default_character_id uuid,
  default_language text not null default 'en',
  creative_direction text not null default 'balanced',
  pacing text not null default 'balanced',
  narration_density text not null default 'balanced',
  gameplay_preservation text not null default 'balanced',
  target_length text not null default 'auto',
  edit_style jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channels_name_length check (char_length(name) between 1 and 120),
  constraint channels_youtube_handle_length check (youtube_handle is null or char_length(youtube_handle) <= 100),
  constraint channels_description_length check (description is null or char_length(description) <= 2000),
  constraint channels_default_language_length check (char_length(default_language) between 2 and 35),
  constraint channels_creative_direction_check check (creative_direction in ('balanced', 'funnier', 'more_dramatic', 'more_analytical')),
  constraint channels_pacing_check check (pacing in ('relaxed', 'balanced', 'tight')),
  constraint channels_narration_density_check check (narration_density in ('light', 'balanced', 'detailed')),
  constraint channels_gameplay_preservation_check check (gameplay_preservation in ('preserve_more', 'balanced', 'cut_more_aggressively')),
  constraint channels_target_length_check check (target_length in ('auto', 'shorter', 'standard', 'longer')),
  constraint channels_edit_style_object check (jsonb_typeof(edit_style) = 'object'),
  constraint channels_id_user_unique unique (id, user_id),
  -- Composite FK: a channel can only reference a character owned by the
  -- same user, enforced at the database level (RLS cannot check referenced
  -- rows and service-role code bypasses RLS).
  constraint channels_default_character_same_owner_fkey
    foreign key (default_character_id, user_id)
    references public.characters (id, user_id)
    on delete set null (default_character_id)
);

create unique index channels_user_name_active_unique_idx
  on public.channels (user_id, lower(name))
  where archived_at is null;

create index channels_user_id_idx on public.channels (user_id);

create trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

create trigger channels_set_updated_at
before update on public.channels
for each row execute function public.set_updated_at();

-- Projects belong to at most one channel; the composite FK guarantees the
-- channel is owned by the same user.
alter table public.projects
  add column channel_id uuid,
  add constraint projects_channel_same_owner_fkey
    foreign key (channel_id, user_id)
    references public.channels (id, user_id)
    on delete set null (channel_id);

create index projects_channel_id_idx on public.projects (channel_id);

-- Creative settings snapshots reference the narrator character (by
-- reference until generation; ownership is enforced via the RLS policies
-- below and server-side validation) and carry the edit-style snapshot.
alter table public.project_creative_settings
  add column character_id uuid references public.characters(id) on delete set null,
  add column edit_style jsonb not null default '{}'::jsonb,
  add constraint project_creative_settings_edit_style_object check (jsonb_typeof(edit_style) = 'object');

-- Profile-level default character (structural successor to the legacy
-- default_narrator_key field, which stays for now but is deprecated).
alter table public.profiles
  add column default_character_id uuid,
  add constraint profiles_default_character_same_owner_fkey
    foreign key (default_character_id, id)
    references public.characters (id, user_id)
    on delete set null (default_character_id);

alter table public.characters enable row level security;
alter table public.channels enable row level security;

create policy "characters_select_own"
  on public.characters
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "characters_insert_own"
  on public.characters
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "characters_update_own"
  on public.characters
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "characters_delete_own"
  on public.characters
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "channels_select_own"
  on public.channels
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "channels_insert_own"
  on public.channels
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "channels_update_own"
  on public.channels
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "channels_delete_own"
  on public.channels
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Recreate the creative-settings write policies with an added ownership
-- predicate: a snapshot may only reference a character owned by the same
-- user (plain FK above cannot express this because the table has no
-- user_id column).
drop policy "project_creative_settings_insert_own_project" on public.project_creative_settings;
drop policy "project_creative_settings_update_own_project" on public.project_creative_settings;

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
    and (
      character_id is null
      or exists (
        select 1 from public.characters c
        where c.id = project_creative_settings.character_id
          and c.user_id = auth.uid()
      )
    )
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
    and (
      character_id is null
      or exists (
        select 1 from public.characters c
        where c.id = project_creative_settings.character_id
          and c.user_id = auth.uid()
      )
    )
  );

comment on table public.characters is 'Reusable narrator identities (voice + speech style). User-level library shared across channels; config is frozen into version rows at generation time.';
comment on table public.channels is 'YouTube channels with creative defaults and edit-style branding. Defaults are copied by value into project_creative_settings at project creation.';
comment on column public.characters.voice_key is 'Voice-provider voice id (not a secret). Nullable until a voice is assigned; ElevenLabs integration lands in Phase 7.';
comment on column public.characters.voice_settings is 'App-validated object. Expected keys: model_id, stability, similarity_boost, style, speed.';
comment on column public.characters.speech_style is 'App-validated object. Expected keys: tone, humor_level, energy, sentence_length, vocabulary_notes, catchphrases[], forbidden_words[], example_lines[].';
comment on column public.channels.edit_style is 'App-validated object of enumerated style tokens. Expected keys: caption_style, zoom_usage, transition_style, intro_style, outro_style.';
comment on column public.project_creative_settings.character_id is 'Narrator character used by this settings snapshot. By reference until generation; resolved config is frozen into version rows at generation time.';
comment on column public.project_creative_settings.edit_style is 'Edit-style snapshot copied from the channel at project creation. Same keys as channels.edit_style.';
comment on column public.profiles.default_character_id is 'Profile-level default character. Successor to the deprecated default_narrator_key.';
