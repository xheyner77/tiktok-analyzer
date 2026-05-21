-- Security fix for Supabase Advisor `rls_disabled_in_public`.
--
-- Remote staging audit on 2026-05-20 found one public table without RLS:
--   public.tiktok_stats_cache
--
-- This table is a server-side TikTok public stats cache used by app/api/analyze.
-- It has no user_id column and is not queried directly from browser clients.
-- Keep it server-only: service_role can manage it, anon/authenticated cannot.

alter table public.tiktok_stats_cache enable row level security;

revoke all on table public.tiktok_stats_cache from anon, authenticated;

drop policy if exists "Service role full access" on public.tiktok_stats_cache;
create policy "Service role full access"
  on public.tiktok_stats_cache
  for all
  to service_role
  using (true)
  with check (true);
