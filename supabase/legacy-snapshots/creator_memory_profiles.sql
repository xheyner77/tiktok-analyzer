-- Persistent creator memory and structured analysis snapshots.

create table if not exists public.creator_memory_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'creator', 'pro', 'scale')),
  memory_json jsonb not null default '{}'::jsonb,
  summary text not null default '',
  prompt_context text not null default '',
  source_analysis_count integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.video_analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  video_id text not null,
  video_url text not null,
  plan text not null default 'free' check (plan in ('free', 'creator', 'pro', 'scale')),
  result_json jsonb not null default '{}'::jsonb,
  snapshot_json jsonb not null default '{}'::jsonb,
  confidence_score numeric(4, 3) not null default 0.5,
  created_at timestamptz not null default now()
);

create unique index if not exists video_analysis_snapshots_user_video_id_key
  on public.video_analysis_snapshots(user_id, video_id);

create index if not exists video_analysis_snapshots_user_created_idx
  on public.video_analysis_snapshots(user_id, created_at desc);

create index if not exists creator_memory_profiles_updated_idx
  on public.creator_memory_profiles(updated_at desc);

alter table public.creator_memory_profiles enable row level security;
alter table public.video_analysis_snapshots enable row level security;

drop policy if exists "Service role full access" on public.creator_memory_profiles;
create policy "Service role full access"
  on public.creator_memory_profiles
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role full access" on public.video_analysis_snapshots;
create policy "Service role full access"
  on public.video_analysis_snapshots
  for all
  to service_role
  using (true)
  with check (true);
