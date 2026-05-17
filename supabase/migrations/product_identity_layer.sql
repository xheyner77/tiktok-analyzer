-- Product Identity Layer: Viralynz vocabulary, creator archetypes, identity cards and reputation.

create table if not exists public.viralynz_vocabulary_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  concept_key text not null,
  label text not null,
  definition text not null,
  trigger text not null,
  example text,
  severity text not null default 'watch' check (severity in ('critical', 'important', 'watch', 'strength')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  created_at timestamptz not null default now()
);

create table if not exists public.creator_archetypes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  archetype_key text not null,
  label text not null,
  description text not null,
  dominant_signals jsonb not null default '[]'::jsonb,
  recommendation_style text not null,
  benchmark_lens text not null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, archetype_key)
);

create table if not exists public.creator_identity_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  title text not null,
  dominant_style text,
  content_reputation text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  evolution jsonb not null default '[]'::jsonb,
  identity_score numeric not null default 0 check (identity_score >= 0 and identity_score <= 100),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id)
);

create table if not exists public.creator_reputation_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  metric_key text not null,
  label text not null,
  grade text not null check (grade in ('Elite', 'Strong', 'Developing', 'Weak')),
  score numeric not null default 0 check (score >= 0 and score <= 100),
  evidence text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_language_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  phrase text not null,
  usage text not null,
  language_scope text not null default 'creator' check (language_scope in ('global', 'creator', 'project')),
  created_at timestamptz not null default now()
);

create index if not exists viralynz_vocabulary_events_user_created_idx on public.viralynz_vocabulary_events(user_id, created_at desc);
create index if not exists creator_archetypes_user_project_idx on public.creator_archetypes(user_id, project_id, active);
create index if not exists creator_identity_cards_user_project_idx on public.creator_identity_cards(user_id, project_id);
create index if not exists creator_reputation_metrics_user_created_idx on public.creator_reputation_metrics(user_id, created_at desc);
create index if not exists product_language_events_user_created_idx on public.product_language_events(user_id, created_at desc);

alter table public.viralynz_vocabulary_events enable row level security;
alter table public.creator_archetypes enable row level security;
alter table public.creator_identity_cards enable row level security;
alter table public.creator_reputation_metrics enable row level security;
alter table public.product_language_events enable row level security;

create policy "Users manage own vocabulary events"
  on public.viralynz_vocabulary_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own creator archetypes"
  on public.creator_archetypes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own identity cards"
  on public.creator_identity_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own reputation metrics"
  on public.creator_reputation_metrics
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own product language"
  on public.product_language_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role manages vocabulary events"
  on public.viralynz_vocabulary_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages creator archetypes"
  on public.creator_archetypes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages identity cards"
  on public.creator_identity_cards
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages reputation metrics"
  on public.creator_reputation_metrics
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages product language"
  on public.product_language_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
