-- Creator Memory Engine v2.
-- Private consolidated memory per user + learning event log per analysis.

create table if not exists public.creator_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  version integer not null default 1,
  memory_level integer not null default 0 check (memory_level >= 0 and memory_level <= 100),
  confidence_score numeric(4, 3) not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  total_analyses_learned_from integer not null default 0 check (total_analyses_learned_from >= 0),
  last_analysis_id uuid references public.analyses(id) on delete set null,
  last_learned_at timestamptz,
  profile_summary text not null default '',
  niche text not null default '',
  audience_profile text not null default '',
  creator_voice text not null default '',
  content_style text not null default '',
  hook_style text not null default '',
  editing_style text not null default '',
  cta_style text not null default '',
  strongest_patterns jsonb not null default '[]'::jsonb,
  weakest_patterns jsonb not null default '[]'::jsonb,
  recurring_mistakes jsonb not null default '[]'::jsonb,
  winning_hooks jsonb not null default '[]'::jsonb,
  losing_hooks jsonb not null default '[]'::jsonb,
  retention_patterns jsonb not null default '[]'::jsonb,
  topic_patterns jsonb not null default '[]'::jsonb,
  vocabulary_patterns jsonb not null default '[]'::jsonb,
  pacing_patterns jsonb not null default '[]'::jsonb,
  format_preferences jsonb not null default '[]'::jsonb,
  do_more_of jsonb not null default '[]'::jsonb,
  avoid_doing jsonb not null default '[]'::jsonb,
  next_experiments jsonb not null default '[]'::jsonb,
  raw_memory_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_memories_user_id_key unique (user_id)
);

create table if not exists public.creator_memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  event_type text not null default 'analysis_learned',
  extracted_insights_json jsonb not null default '{}'::jsonb,
  memory_before_summary text not null default '',
  memory_after_summary text not null default '',
  confidence_delta numeric(5, 3) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists creator_memories_user_updated_idx
  on public.creator_memories(user_id, updated_at desc);

create index if not exists creator_memory_events_user_created_idx
  on public.creator_memory_events(user_id, created_at desc);

create index if not exists creator_memory_events_analysis_idx
  on public.creator_memory_events(analysis_id);

create or replace function public.set_creator_memories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_creator_memories_updated_at on public.creator_memories;
create trigger set_creator_memories_updated_at
  before update on public.creator_memories
  for each row
  execute function public.set_creator_memories_updated_at();

alter table public.creator_memories enable row level security;
alter table public.creator_memory_events enable row level security;

drop policy if exists "Users can read own creator memory" on public.creator_memories;
create policy "Users can read own creator memory"
  on public.creator_memories
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own creator memory" on public.creator_memories;
create policy "Users can insert own creator memory"
  on public.creator_memories
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own creator memory" on public.creator_memories;
create policy "Users can update own creator memory"
  on public.creator_memories
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own creator memory" on public.creator_memories;
create policy "Users can delete own creator memory"
  on public.creator_memories
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Service role full access creator memories" on public.creator_memories;
create policy "Service role full access creator memories"
  on public.creator_memories
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Users can read own creator memory events" on public.creator_memory_events;
create policy "Users can read own creator memory events"
  on public.creator_memory_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own creator memory events" on public.creator_memory_events;
create policy "Users can insert own creator memory events"
  on public.creator_memory_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own creator memory events" on public.creator_memory_events;
create policy "Users can delete own creator memory events"
  on public.creator_memory_events
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Service role full access creator memory events" on public.creator_memory_events;
create policy "Service role full access creator memory events"
  on public.creator_memory_events
  for all
  to service_role
  using (true)
  with check (true);
