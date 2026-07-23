-- Phase 2.1: Asset metadata model for private Cloudflare R2 storage.
--
-- The assets table stores metadata for objects living in private R2
-- buckets: the original gameplay source now, generated media (proxies,
-- narration audio, renders) in later phases. Object bytes never live in
-- Postgres; browser access always goes through short-lived signed URLs
-- generated server-side after ownership checks.
--
-- Writes go through server actions running under the user's session, so
-- the RLS write policies are owner-scoped with strict checks. The
-- created_by_job_id column from the schema spec is added together with
-- the processing_jobs table in Phase 3.
--
-- Purely additive. Requires PostgreSQL 15+ for the column-list form of
-- ON DELETE SET NULL used by the composite foreign key.

create type public.asset_type as enum (
  'original_source',
  'proxy_video',
  'extracted_audio',
  'frame_samples',
  'narration_audio',
  'intermediate_render',
  'final_video',
  'captions',
  'preview_image'
);

create type public.asset_status as enum (
  'pending',
  'uploading',
  'available',
  'failed',
  'delete_pending',
  'deleted'
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_type public.asset_type not null,
  status public.asset_status not null default 'pending',
  storage_provider text not null default 'r2',
  bucket text not null,
  object_key text not null,
  original_filename text,
  content_type text,
  byte_size bigint,
  checksum_sha256 text,
  duration_ms integer,
  width integer,
  height integer,
  frame_rate numeric,
  video_codec text,
  audio_codec text,
  metadata jsonb not null default '{}'::jsonb,
  available_at timestamptz,
  delete_requested_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_storage_provider_check check (storage_provider in ('r2')),
  constraint assets_bucket_length check (char_length(bucket) between 1 and 200),
  constraint assets_object_key_length check (char_length(object_key) between 1 and 1024),
  constraint assets_original_filename_length check (original_filename is null or char_length(original_filename) between 1 and 500),
  constraint assets_content_type_length check (content_type is null or char_length(content_type) between 1 and 200),
  constraint assets_byte_size_non_negative check (byte_size is null or byte_size >= 0),
  constraint assets_duration_non_negative check (duration_ms is null or duration_ms >= 0),
  constraint assets_width_positive check (width is null or width > 0),
  constraint assets_height_positive check (height is null or height > 0),
  constraint assets_frame_rate_positive check (frame_rate is null or frame_rate > 0),
  constraint assets_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint assets_bucket_object_key_unique unique (bucket, object_key),
  constraint assets_id_project_unique unique (id, project_id)
);

create index assets_project_type_created_at_idx
  on public.assets (project_id, asset_type, created_at desc);

create index assets_project_status_idx on public.assets (project_id, status);

-- At most one live original source per project. Aborted or failed uploads
-- must set deleted_at (after the multipart upload is aborted in R2) to
-- free the slot for a retry.
create unique index assets_one_original_source_per_project_idx
  on public.assets (project_id)
  where asset_type = 'original_source' and deleted_at is null;

create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

-- The project's uploaded source. The composite FK guarantees the asset
-- belongs to the same project.
alter table public.projects
  add column source_asset_id uuid,
  add constraint projects_source_asset_same_project_fkey
    foreign key (source_asset_id, id)
    references public.assets (id, project_id)
    on delete set null (source_asset_id);

alter table public.assets enable row level security;

create policy "assets_select_own_project"
  on public.assets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = assets.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "assets_insert_own_project"
  on public.assets
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = assets.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
    and status in ('pending', 'uploading')
  );

create policy "assets_update_own_project"
  on public.assets
  for update
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = assets.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = assets.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

comment on table public.assets is 'Metadata for private R2 objects (original gameplay sources, later generated media). Bytes live in R2; browser access only via short-lived server-signed URLs.';
comment on column public.assets.object_key is 'Server-generated R2 key. Never derived from unsanitized user input.';
comment on column public.assets.original_filename is 'Display only. Never used for storage paths without sanitization.';
comment on column public.assets.metadata is 'App-validated object: upload details now, probe results (Phase 4) later.';
comment on column public.projects.source_asset_id is 'The uploaded original gameplay source for this project.';
