-- TikTok Display API sync: scopes, profile stats and raw video metrics.

alter table public.tiktok_accounts
  add column if not exists refresh_expires_at timestamptz,
  add column if not exists environment text not null default 'unknown',
  add column if not exists sync_status text,
  add column if not exists sync_error text;

alter table public.tiktok_videos
  add column if not exists description text,
  add column if not exists cover_image_url text,
  add column if not exists fetched_at timestamptz not null default now(),
  add column if not exists raw jsonb;

update public.tiktok_videos
set description = coalesce(description, caption),
    cover_image_url = coalesce(cover_image_url, cover_url),
    fetched_at = coalesce(fetched_at, synced_at, now())
where description is null
   or cover_image_url is null
   or fetched_at is null;

create unique index if not exists tiktok_videos_user_video_unique
  on public.tiktok_videos (user_id, tiktok_video_id);

create table if not exists public.tiktok_profile_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tiktok_account_id uuid not null references public.tiktok_accounts(id) on delete cascade,
  follower_count bigint,
  following_count bigint,
  likes_count bigint,
  video_count bigint,
  bio_description text,
  profile_deep_link text,
  is_verified boolean,
  fetched_at timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, tiktok_account_id)
);

create index if not exists tiktok_profile_stats_user_idx
  on public.tiktok_profile_stats (user_id, fetched_at desc);

create index if not exists tiktok_profile_stats_account_idx
  on public.tiktok_profile_stats (tiktok_account_id);

drop trigger if exists tiktok_profile_stats_updated_at on public.tiktok_profile_stats;
create trigger tiktok_profile_stats_updated_at
  before update on public.tiktok_profile_stats
  for each row execute function public.handle_updated_at();

alter table public.tiktok_accounts enable row level security;
alter table public.tiktok_videos enable row level security;
alter table public.tiktok_profile_stats enable row level security;

grant select on table public.tiktok_accounts to authenticated;
grant select on table public.tiktok_videos to authenticated;
grant select on table public.tiktok_profile_stats to authenticated;
grant select, insert, update, delete on table public.tiktok_profile_stats to service_role;

drop policy if exists "Users can read own TikTok accounts" on public.tiktok_accounts;
create policy "Users can read own TikTok accounts"
  on public.tiktok_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own TikTok videos" on public.tiktok_videos;
create policy "Users can read own TikTok videos"
  on public.tiktok_videos
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own TikTok profile stats" on public.tiktok_profile_stats;
create policy "Users can read own TikTok profile stats"
  on public.tiktok_profile_stats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role full access" on public.tiktok_profile_stats;
create policy "Service role full access"
  on public.tiktok_profile_stats
  for all
  to service_role
  using (true)
  with check (true);
