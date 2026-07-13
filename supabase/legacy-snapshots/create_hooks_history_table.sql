-- Run this in Supabase -> SQL Editor

create table if not exists public.hooks_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  batch_id      uuid not null default gen_random_uuid(),
  hook_text     text not null,
  context       text not null,
  scene         text,
  person        text,
  tone          text not null,
  variant_of    text,
  is_favorite   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists hooks_history_user_created_idx
  on public.hooks_history (user_id, created_at desc);

create index if not exists hooks_history_user_favorite_idx
  on public.hooks_history (user_id, is_favorite, created_at desc);

alter table public.hooks_history enable row level security;

create policy "Users can read own hooks history"
  on public.hooks_history for select
  using (auth.uid() = user_id);

create policy "Users can update own hooks history"
  on public.hooks_history for update
  using (auth.uid() = user_id);
