create table if not exists public.expert_mode_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete cascade,
  enabled boolean not null default false,
  analysis_depth text not null default 'standard' check (analysis_depth in ('standard', 'detailed', 'expert')),
  weight_profile jsonb not null default '{}'::jsonb,
  custom_prompt_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id)
);

create index if not exists expert_mode_settings_user_updated_idx
  on public.expert_mode_settings (user_id, updated_at desc);

create table if not exists public.expert_custom_benchmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete cascade,
  label text not null,
  scope text not null check (scope in ('niche', 'format', 'facecam', 'short_video', 'project')),
  filter_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expert_custom_benchmarks_user_scope_idx
  on public.expert_custom_benchmarks (user_id, scope, active);

create table if not exists public.expert_custom_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete cascade,
  rule_key text not null,
  label text not null,
  condition_json jsonb not null default '{}'::jsonb,
  action text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expert_custom_rules_user_active_idx
  on public.expert_custom_rules (user_id, active, updated_at desc);

create table if not exists public.expert_rule_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete cascade,
  rule_key text not null,
  triggered boolean not null default false,
  evidence text,
  action text,
  created_at timestamptz not null default now()
);

create index if not exists expert_rule_evaluations_user_triggered_idx
  on public.expert_rule_evaluations (user_id, triggered, created_at desc);

create table if not exists public.expert_copilot_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  prompt text not null,
  mode text not null check (mode in ('brainstorm', 'rewrite', 'variant', 'structure')),
  memory_used text,
  output_preview text,
  created_at timestamptz not null default now()
);

create index if not exists expert_copilot_events_user_created_idx
  on public.expert_copilot_events (user_id, created_at desc);

alter table public.expert_mode_settings enable row level security;
alter table public.expert_custom_benchmarks enable row level security;
alter table public.expert_custom_rules enable row level security;
alter table public.expert_rule_evaluations enable row level security;
alter table public.expert_copilot_events enable row level security;

drop policy if exists "Users read own expert mode settings" on public.expert_mode_settings;
create policy "Users read own expert mode settings"
  on public.expert_mode_settings for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own expert benchmarks" on public.expert_custom_benchmarks;
create policy "Users read own expert benchmarks"
  on public.expert_custom_benchmarks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own expert rules" on public.expert_custom_rules;
create policy "Users read own expert rules"
  on public.expert_custom_rules for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own expert rule evaluations" on public.expert_rule_evaluations;
create policy "Users read own expert rule evaluations"
  on public.expert_rule_evaluations for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own expert copilot events" on public.expert_copilot_events;
create policy "Users read own expert copilot events"
  on public.expert_copilot_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages expert mode settings" on public.expert_mode_settings;
create policy "Service role manages expert mode settings"
  on public.expert_mode_settings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages expert benchmarks" on public.expert_custom_benchmarks;
create policy "Service role manages expert benchmarks"
  on public.expert_custom_benchmarks for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages expert rules" on public.expert_custom_rules;
create policy "Service role manages expert rules"
  on public.expert_custom_rules for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages expert rule evaluations" on public.expert_rule_evaluations;
create policy "Service role manages expert rule evaluations"
  on public.expert_rule_evaluations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages expert copilot events" on public.expert_copilot_events;
create policy "Service role manages expert copilot events"
  on public.expert_copilot_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
