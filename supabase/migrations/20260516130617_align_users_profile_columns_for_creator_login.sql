alter table public.users
  add column if not exists reconstructions_count integer not null default 0,
  add column if not exists tiktok_open_id text,
  add column if not exists tiktok_display_name text,
  add column if not exists tiktok_avatar_url text,
  add column if not exists tiktok_connected_at timestamptz;

update public.users
set plan = 'creator', reconstructions_count = coalesce(reconstructions_count, 0)
where lower(email) = lower('xheyner77+viralynz-staging-creator@gmail.com');