-- Content Operating System primitives.

create table if not exists public.hook_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  hook_text text not null,
  status text not null default 'used' check (status in ('performant', 'flop', 'reposted', 'saved', 'used')),
  niche text,
  format_type text,
  score integer not null default 0 check (score between 0 and 100),
  tags jsonb not null default '[]'::jsonb,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repost_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  priority_score integer not null default 0 check (priority_score between 0 and 100),
  repost_potential integer not null default 0 check (repost_potential between 0 and 100),
  main_problem text not null default '',
  status text not null default 'a_retravailler' check (status in ('a_retravailler', 'repost_conseille', 'surveiller', 'reposte', 'archive')),
  last_analysis_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  experiment_type text not null check (experiment_type in ('hook_test', 'intro_test', 'cta_test')),
  title text not null,
  variants jsonb not null default '[]'::jsonb,
  winner_variant_id text,
  status text not null default 'draft' check (status in ('draft', 'running', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_dna_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  dna_json jsonb not null default '{}'::jsonb,
  source_analysis_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hook_vault_user_created_idx on public.hook_vault(user_id, created_at desc);
create index if not exists hook_vault_tags_gin_idx on public.hook_vault using gin(tags);
create index if not exists repost_queue_user_priority_idx on public.repost_queue(user_id, priority_score desc);
create index if not exists content_experiments_user_created_idx on public.content_experiments(user_id, created_at desc);
create index if not exists creator_dna_snapshots_user_created_idx on public.creator_dna_snapshots(user_id, created_at desc);

alter table public.hook_vault enable row level security;
alter table public.repost_queue enable row level security;
alter table public.content_experiments enable row level security;
alter table public.creator_dna_snapshots enable row level security;

drop policy if exists "Service role full access" on public.hook_vault;
create policy "Service role full access" on public.hook_vault for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.repost_queue;
create policy "Service role full access" on public.repost_queue for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.content_experiments;
create policy "Service role full access" on public.content_experiments for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.creator_dna_snapshots;
create policy "Service role full access" on public.creator_dna_snapshots for all to service_role using (true) with check (true);
