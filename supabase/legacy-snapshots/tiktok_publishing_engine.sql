-- TikTok Publishing Engine: drafts, smart scheduling, pre-publish checks and content pipeline.

create table if not exists public.content_publication_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  platform text not null default 'tiktok' check (platform in ('tiktok', 'shorts', 'reels')),
  status text not null default 'idea' check (status in ('idea', 'editing', 'ready', 'scheduled', 'posted', 'repost_candidate')),
  action text not null default 'queue' check (action in ('post_now', 'schedule', 'draft', 'repost_schedule', 'queue')),
  title text not null,
  hook text,
  caption text,
  hashtags jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz,
  schedule_reason text,
  source_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_schedule_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  platform text not null default 'tiktok' check (platform in ('tiktok', 'shorts', 'reels')),
  day_label text not null,
  time_label text not null,
  window_label text not null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  reason text not null,
  source_signals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pre_publish_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  hook_risk numeric not null default 0 check (hook_risk >= 0 and hook_risk <= 100),
  cta_risk numeric not null default 0 check (cta_risk >= 0 and cta_risk <= 100),
  intro_risk numeric not null default 0 check (intro_risk >= 0 and intro_risk <= 100),
  repost_potential numeric not null default 0 check (repost_potential >= 0 and repost_potential <= 100),
  strength text,
  issues jsonb not null default '[]'::jsonb,
  next_fix text,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  engine_version text not null default 'publishing-engine-v1',
  created_at timestamptz not null default now()
);

create table if not exists public.publication_workspace_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  platform text not null default 'tiktok' check (platform in ('tiktok', 'shorts', 'reels')),
  hook text,
  caption text,
  hashtags jsonb not null default '[]'::jsonb,
  cta text,
  structure jsonb not null default '[]'::jsonb,
  repost_version jsonb,
  editable_fields jsonb not null default '["hook","caption","hashtags","cta","structure","repost_version"]'::jsonb,
  readiness_score numeric not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  status text not null default 'draft' check (status in ('draft', 'ready', 'scheduled', 'posted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auto_repost_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.content_projects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  title text not null,
  priority_score numeric not null default 0 check (priority_score >= 0 and priority_score <= 100),
  reason text not null,
  generated_hook text,
  suggested_timing text,
  scheduling_confidence numeric not null default 0 check (scheduling_confidence >= 0 and scheduling_confidence <= 100),
  status text not null default 'suggested' check (status in ('suggested', 'queued', 'scheduled', 'posted', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_publication_items_user_status_idx on public.content_publication_items(user_id, status, updated_at desc);
create index if not exists smart_schedule_recommendations_user_created_idx on public.smart_schedule_recommendations(user_id, created_at desc);
create index if not exists pre_publish_checks_user_analysis_idx on public.pre_publish_checks(user_id, analysis_id);
create index if not exists publication_workspace_drafts_user_status_idx on public.publication_workspace_drafts(user_id, status, updated_at desc);
create index if not exists auto_repost_suggestions_user_status_idx on public.auto_repost_suggestions(user_id, status, priority_score desc);

alter table public.content_publication_items enable row level security;
alter table public.smart_schedule_recommendations enable row level security;
alter table public.pre_publish_checks enable row level security;
alter table public.publication_workspace_drafts enable row level security;
alter table public.auto_repost_suggestions enable row level security;

create policy "Users manage own publication items"
  on public.content_publication_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own schedule recommendations"
  on public.smart_schedule_recommendations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own pre publish checks"
  on public.pre_publish_checks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own publication drafts"
  on public.publication_workspace_drafts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own auto repost suggestions"
  on public.auto_repost_suggestions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role manages publication items"
  on public.content_publication_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages schedule recommendations"
  on public.smart_schedule_recommendations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages pre publish checks"
  on public.pre_publish_checks
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages publication drafts"
  on public.publication_workspace_drafts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages auto repost suggestions"
  on public.auto_repost_suggestions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
