create table if not exists public.intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  intelligence_score integer not null default 0 check (intelligence_score between 0 and 100),
  summary text,
  central_context jsonb not null default '[]'::jsonb,
  source_counts jsonb not null default '{}'::jsonb,
  engine_version text not null default 'cumulative-intelligence-v1',
  created_at timestamptz not null default now()
);

create index if not exists intelligence_snapshots_user_created_idx
  on public.intelligence_snapshots (user_id, created_at desc);

create table if not exists public.daily_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  briefing_date date not null default current_date,
  items jsonb not null default '[]'::jsonb,
  confidence integer not null default 0 check (confidence between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, briefing_date)
);

create index if not exists daily_briefings_user_date_idx
  on public.daily_briefings (user_id, briefing_date desc);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  week_start date not null,
  summary text,
  metrics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_reports_user_week_idx
  on public.weekly_reports (user_id, week_start desc);

create table if not exists public.predictive_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  signal_type text not null check (signal_type in ('hook', 'repost', 'structure_risk', 'project', 'cta')),
  title text not null,
  prediction text not null,
  evidence text,
  confidence integer not null default 0 check (confidence between 0 and 100),
  impact_score integer not null default 0 check (impact_score between 0 and 100),
  source_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists predictive_signals_user_impact_idx
  on public.predictive_signals (user_id, impact_score desc, created_at desc);

alter table public.intelligence_snapshots enable row level security;
alter table public.daily_briefings enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.predictive_signals enable row level security;

drop policy if exists "Users read own intelligence snapshots" on public.intelligence_snapshots;
create policy "Users read own intelligence snapshots"
  on public.intelligence_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own daily briefings" on public.daily_briefings;
create policy "Users read own daily briefings"
  on public.daily_briefings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own weekly reports" on public.weekly_reports;
create policy "Users read own weekly reports"
  on public.weekly_reports
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own predictive signals" on public.predictive_signals;
create policy "Users read own predictive signals"
  on public.predictive_signals
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages intelligence snapshots" on public.intelligence_snapshots;
create policy "Service role manages intelligence snapshots"
  on public.intelligence_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages daily briefings" on public.daily_briefings;
create policy "Service role manages daily briefings"
  on public.daily_briefings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages weekly reports" on public.weekly_reports;
create policy "Service role manages weekly reports"
  on public.weekly_reports
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages predictive signals" on public.predictive_signals;
create policy "Service role manages predictive signals"
  on public.predictive_signals
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
