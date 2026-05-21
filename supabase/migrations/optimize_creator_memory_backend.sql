-- Advisor cleanup for the real creator memory backend.

drop index if exists public.creator_memory_profiles_id_key;
drop index if exists public.creator_memory_profiles_user_id_idx;

create index if not exists creator_memory_facts_analysis_idx on public.creator_memory_facts(analysis_id);
create index if not exists creator_memory_embeddings_user_idx on public.creator_memory_embeddings(user_id);
create index if not exists creator_memory_jobs_user_idx on public.creator_memory_jobs(user_id);
create index if not exists creator_memory_jobs_analysis_idx on public.creator_memory_jobs(analysis_id);

drop policy if exists "Users can read own memory profiles" on public.creator_memory_profiles;
create policy "Users can read own memory profiles" on public.creator_memory_profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory facts" on public.creator_memory_facts;
create policy "Users can read own memory facts" on public.creator_memory_facts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory embeddings" on public.creator_memory_embeddings;
create policy "Users can read own memory embeddings" on public.creator_memory_embeddings
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory snapshots" on public.creator_memory_snapshots;
create policy "Users can read own memory snapshots" on public.creator_memory_snapshots
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory jobs" on public.creator_memory_jobs;
create policy "Users can read own memory jobs" on public.creator_memory_jobs
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory usage" on public.creator_memory_usage;
create policy "Users can read own memory usage" on public.creator_memory_usage
  for select to authenticated using (user_id = (select auth.uid()));
