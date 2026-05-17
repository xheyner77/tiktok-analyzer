create table if not exists public.content_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  niche text,
  format_type text,
  status text not null default 'learning' check (status in ('active', 'learning', 'needs_repost', 'archived')),
  progression_score integer not null default 0 check (progression_score between 0 and 100),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists content_projects_user_updated_idx
  on public.content_projects (user_id, updated_at desc);

create table if not exists public.project_memory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.content_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text,
  hooks jsonb not null default '[]'::jsonb,
  structures jsonb not null default '[]'::jsonb,
  benchmarks jsonb not null default '[]'::jsonb,
  recurring_errors jsonb not null default '[]'::jsonb,
  patterns jsonb not null default '[]'::jsonb,
  source_analysis_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists project_memory_user_updated_idx
  on public.project_memory (user_id, updated_at desc);

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.content_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete cascade,
  item_type text not null check (item_type in ('video', 'analysis', 'hook', 'repost', 'pattern', 'benchmark')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_items_project_created_idx
  on public.project_items (project_id, created_at desc);

create table if not exists public.workspace_experiments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.content_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  experiment_type text not null check (experiment_type in ('hook_test', 'intro_test', 'cta_test', 'structure_test')),
  title text not null,
  variants jsonb not null default '[]'::jsonb,
  learning text,
  status text not null default 'draft' check (status in ('draft', 'running', 'learned', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_experiments_project_updated_idx
  on public.workspace_experiments (project_id, updated_at desc);

create table if not exists public.workspace_feed_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.content_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('pattern', 'hook', 'repost', 'progress', 'experiment', 'team')),
  title text not null,
  body text not null,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_feed_events_user_created_idx
  on public.workspace_feed_events (user_id, created_at desc);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete cascade,
  member_email text not null,
  role text not null check (role in ('owner', 'strategist', 'creator', 'editor', 'client_viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  unique (project_id, member_email)
);

create index if not exists workspace_members_user_project_idx
  on public.workspace_members (user_id, project_id);

alter table public.content_projects enable row level security;
alter table public.project_memory enable row level security;
alter table public.project_items enable row level security;
alter table public.workspace_experiments enable row level security;
alter table public.workspace_feed_events enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "Users read own content projects" on public.content_projects;
create policy "Users read own content projects"
  on public.content_projects
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own project memory" on public.project_memory;
create policy "Users read own project memory"
  on public.project_memory
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own project items" on public.project_items;
create policy "Users read own project items"
  on public.project_items
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own workspace experiments" on public.workspace_experiments;
create policy "Users read own workspace experiments"
  on public.workspace_experiments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own workspace feed" on public.workspace_feed_events;
create policy "Users read own workspace feed"
  on public.workspace_feed_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own workspace members" on public.workspace_members;
create policy "Users read own workspace members"
  on public.workspace_members
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages content projects" on public.content_projects;
create policy "Service role manages content projects"
  on public.content_projects
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages project memory" on public.project_memory;
create policy "Service role manages project memory"
  on public.project_memory
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages project items" on public.project_items;
create policy "Service role manages project items"
  on public.project_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages workspace experiments" on public.workspace_experiments;
create policy "Service role manages workspace experiments"
  on public.workspace_experiments
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages workspace feed" on public.workspace_feed_events;
create policy "Service role manages workspace feed"
  on public.workspace_feed_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages workspace members" on public.workspace_members;
create policy "Service role manages workspace members"
  on public.workspace_members
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
