-- Content Execution Engine: hook/CTA/caption rewrites, structure rewrites and editing suggestions.

create table if not exists public.execution_variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  variant_type text not null check (variant_type in ('hook', 'cta', 'caption', 'intro')),
  mode text not null,
  content text not null,
  why text,
  based_on jsonb not null default '[]'::jsonb,
  score numeric not null default 0 check (score >= 0 and score <= 100),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  status text not null default 'generated' check (status in ('generated', 'saved', 'testing', 'winner', 'discarded')),
  engine_version text not null default 'content-execution-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.structure_rewrites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  current_order jsonb not null default '[]'::jsonb,
  recommended_order jsonb not null default '[]'::jsonb,
  reason text not null,
  expected_impact text not null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  status text not null default 'suggested' check (status in ('suggested', 'applied', 'testing', 'dismissed')),
  engine_version text not null default 'content-execution-v1',
  created_at timestamptz not null default now()
);

create table if not exists public.auto_variant_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  title text not null,
  variants jsonb not null default '[]'::jsonb,
  test_suggestion text not null,
  save_reason text not null,
  status text not null default 'generated' check (status in ('generated', 'saved', 'testing', 'completed', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.editing_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  suggestion_type text not null check (suggestion_type in ('zoom', 'cut_speed', 'on_screen_text', 'pattern_interrupt', 'caption_density')),
  timestamp_label text,
  suggestion text not null,
  reason text not null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  status text not null default 'suggested' check (status in ('suggested', 'applied', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists execution_variants_user_type_idx on public.execution_variants(user_id, variant_type, created_at desc);
create index if not exists structure_rewrites_user_created_idx on public.structure_rewrites(user_id, created_at desc);
create index if not exists auto_variant_sets_user_status_idx on public.auto_variant_sets(user_id, status, updated_at desc);
create index if not exists editing_suggestions_user_created_idx on public.editing_suggestions(user_id, created_at desc);

alter table public.execution_variants enable row level security;
alter table public.structure_rewrites enable row level security;
alter table public.auto_variant_sets enable row level security;
alter table public.editing_suggestions enable row level security;

create policy "Users manage own execution variants"
  on public.execution_variants
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own structure rewrites"
  on public.structure_rewrites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own auto variant sets"
  on public.auto_variant_sets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own editing suggestions"
  on public.editing_suggestions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role manages execution variants"
  on public.execution_variants
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages structure rewrites"
  on public.structure_rewrites
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages auto variant sets"
  on public.auto_variant_sets
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages editing suggestions"
  on public.editing_suggestions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
