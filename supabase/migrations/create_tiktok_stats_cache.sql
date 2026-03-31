-- Run this in Supabase -> SQL Editor

create table if not exists public.tiktok_stats_cache (
  video_url    text primary key,
  stats_json   jsonb not null,
  fetched_at   timestamptz not null default now()
);

create index if not exists tiktok_stats_cache_fetched_idx
  on public.tiktok_stats_cache (fetched_at desc);
