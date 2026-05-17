-- Smart automation layer: proactive queues, alerts, experiments and workflows.

create table if not exists public.smart_automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete cascade,
  automation_type text not null,
  trigger_json jsonb not null default '{}'::jsonb,
  action_json jsonb not null default '{}'::jsonb,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_automation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  automation_type text not null,
  title text not null,
  trigger text not null,
  action text not null,
  reason text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  status text not null default 'suggested' check (status in ('active', 'suggested', 'learning', 'dismissed', 'done')),
  source_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_repost_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  title text not null,
  priority_score numeric not null default 0 check (priority_score >= 0 and priority_score <= 100),
  reason text not null,
  corrections jsonb not null default '[]'::jsonb,
  effort text not null default 'moyen' check (effort in ('faible', 'moyen', 'eleve')),
  status text not null default 'queued' check (status in ('queued', 'planned', 'in_progress', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  alert_type text not null,
  title text not null,
  body text not null,
  tone text not null default 'system' check (tone in ('opportunity', 'warning', 'progress', 'system')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  status text not null default 'unread' check (status in ('unread', 'read', 'dismissed', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.auto_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  experiment_type text not null check (experiment_type in ('hook_ab', 'intro_shortening', 'payoff_shift', 'cta_variant')),
  title text not null,
  variants jsonb not null default '[]'::jsonb,
  success_signal text not null,
  next_step text not null,
  status text not null default 'suggested' check (status in ('suggested', 'running', 'completed', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete cascade,
  workflow_key text not null,
  name text not null,
  if_signal text not null,
  then_actions jsonb not null default '[]'::jsonb,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, workflow_key)
);

create index if not exists smart_automation_rules_user_project_idx on public.smart_automation_rules(user_id, project_id);
create index if not exists smart_automation_events_user_created_idx on public.smart_automation_events(user_id, created_at desc);
create index if not exists automation_repost_queue_user_status_idx on public.automation_repost_queue(user_id, status, priority_score desc);
create index if not exists smart_alerts_user_status_idx on public.smart_alerts(user_id, status, created_at desc);
create index if not exists auto_experiments_user_status_idx on public.auto_experiments(user_id, status, created_at desc);
create index if not exists automation_workflows_user_project_idx on public.automation_workflows(user_id, project_id, active);

alter table public.smart_automation_rules enable row level security;
alter table public.smart_automation_events enable row level security;
alter table public.automation_repost_queue enable row level security;
alter table public.smart_alerts enable row level security;
alter table public.auto_experiments enable row level security;
alter table public.automation_workflows enable row level security;

create policy "Users manage own smart automation rules"
  on public.smart_automation_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own smart automation events"
  on public.smart_automation_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own automation repost queue"
  on public.automation_repost_queue
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own smart alerts"
  on public.smart_alerts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own auto experiments"
  on public.auto_experiments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own automation workflows"
  on public.automation_workflows
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role manages smart automation rules"
  on public.smart_automation_rules
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages smart automation events"
  on public.smart_automation_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages automation repost queue"
  on public.automation_repost_queue
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages smart alerts"
  on public.smart_alerts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages auto experiments"
  on public.auto_experiments
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages automation workflows"
  on public.automation_workflows
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
