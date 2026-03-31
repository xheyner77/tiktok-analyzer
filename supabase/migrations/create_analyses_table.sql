-- Run this in Supabase → SQL Editor

create table if not exists public.analyses (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  video_url   text        not null,
  result      jsonb       not null,
  created_at  timestamptz not null default now()
);

-- Fast lookup: latest analyses per user
create index if not exists analyses_user_created_idx
  on public.analyses (user_id, created_at desc);

-- Row Level Security (service role bypasses RLS automatically)
alter table public.analyses enable row level security;

create policy "Users can read own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);
