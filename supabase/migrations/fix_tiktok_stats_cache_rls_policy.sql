-- Fix Supabase Advisor rls_enabled_no_policy for public.tiktok_stats_cache.
--
-- tiktok_stats_cache is a server-side public TikTok stats cache used by
-- app/api/analyze/route.ts through the server-only Supabase service-role
-- client. The table has no user ownership column, so it must not be exposed
-- directly to anon or authenticated users.

alter table public.tiktok_stats_cache enable row level security;

revoke all on table public.tiktok_stats_cache from anon;
revoke all on table public.tiktok_stats_cache from authenticated;

grant select, insert, update, delete on table public.tiktok_stats_cache to service_role;

drop policy if exists "Service role full access" on public.tiktok_stats_cache;
drop policy if exists "tiktok_stats_cache_service_role_full_access" on public.tiktok_stats_cache;

create policy "tiktok_stats_cache_service_role_full_access"
  on public.tiktok_stats_cache
  for all
  to service_role
  using (true)
  with check (true);
