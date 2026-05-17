-- Repost feedback loop: user outcomes that improve recommendation ranking.

create table if not exists public.repost_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  video_id text,
  reposted boolean not null default false,
  hook_better boolean,
  retention_better text not null default 'unknown' check (retention_better in ('worse', 'same', 'better', 'unknown')),
  engagement_better text not null default 'unknown' check (engagement_better in ('worse', 'same', 'better', 'unknown')),
  performed_better text not null default 'unknown' check (performed_better in ('worse', 'same', 'better', 'unknown')),
  useful boolean,
  satisfaction integer not null default 55 check (satisfaction between 0 and 100),
  improvement_score integer not null default 50 check (improvement_score between 0 and 100),
  applied_recommendations jsonb not null default '[]'::jsonb,
  ignored_recommendations jsonb not null default '[]'::jsonb,
  pattern_keys jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.recommendation_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  recommendation text not null,
  pattern_key text not null,
  action text not null check (action in ('applied', 'ignored')),
  useful boolean,
  reposted boolean not null default false,
  outcome_score integer not null default 50 check (outcome_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.recommendation_learning_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pattern_key text not null,
  recommendation text not null,
  applied_count integer not null default 0,
  ignored_count integer not null default 0,
  useful_count integer not null default 0,
  reposted_count integer not null default 0,
  positive_outcome_count integer not null default 0,
  priority_score integer not null default 50 check (priority_score between 0 and 100),
  confidence_score integer not null default 20 check (confidence_score between 0 and 100),
  usefulness_score integer not null default 0 check (usefulness_score between 0 and 100),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists recommendation_learning_patterns_user_key
  on public.recommendation_learning_patterns(user_id, pattern_key);

create index if not exists repost_feedback_user_created_idx on public.repost_feedback(user_id, created_at desc);
create index if not exists recommendation_feedback_events_user_created_idx on public.recommendation_feedback_events(user_id, created_at desc);
create index if not exists recommendation_learning_patterns_user_priority_idx on public.recommendation_learning_patterns(user_id, priority_score desc);

alter table public.repost_feedback enable row level security;
alter table public.recommendation_feedback_events enable row level security;
alter table public.recommendation_learning_patterns enable row level security;

drop policy if exists "Service role full access" on public.repost_feedback;
create policy "Service role full access" on public.repost_feedback for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.recommendation_feedback_events;
create policy "Service role full access" on public.recommendation_feedback_events for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.recommendation_learning_patterns;
create policy "Service role full access" on public.recommendation_learning_patterns for all to service_role using (true) with check (true);
