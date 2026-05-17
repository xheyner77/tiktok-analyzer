create table if not exists public.strategic_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  project_id uuid references public.content_projects(id) on delete set null,
  action_type text not null check (action_type in ('repost_video', 'test_hook', 'fix_cta', 'prioritize_project', 'improve_structure', 'reduce_intro')),
  title text not null,
  action text not null,
  reason text not null,
  decision_context text,
  opportunity_score integer not null default 0 check (opportunity_score between 0 and 100),
  impact_score integer not null default 0 check (impact_score between 0 and 100),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  effort text not null check (effort in ('faible', 'moyen', 'eleve')),
  priority text not null check (priority in ('urgent', 'high', 'medium', 'low')),
  source_signals jsonb not null default '{}'::jsonb,
  engine_version text not null default 'strategic-decision-v1',
  status text not null default 'open' check (status in ('open', 'done', 'dismissed', 'learned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists strategic_decisions_user_priority_idx
  on public.strategic_decisions (user_id, status, opportunity_score desc, created_at desc);

create index if not exists strategic_decisions_project_priority_idx
  on public.strategic_decisions (project_id, opportunity_score desc, created_at desc)
  where project_id is not null;

alter table public.strategic_decisions enable row level security;

drop policy if exists "Users read own strategic decisions" on public.strategic_decisions;
create policy "Users read own strategic decisions"
  on public.strategic_decisions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages strategic decisions" on public.strategic_decisions;
create policy "Service role manages strategic decisions"
  on public.strategic_decisions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
