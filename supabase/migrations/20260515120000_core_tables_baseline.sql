-- Reproducible baseline for tables that originally existed only in the
-- project's manual supabase/schema.sql snapshot. Every statement is
-- idempotent so an existing linked project can record this migration safely.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'creator', 'pro', 'lifetime', 'scale', 'elite')),
  analyses_count integer not null default 0,
  hooks_count integer not null default 0,
  reconstructions_count integer not null default 0,
  last_reset_at timestamptz not null default now(),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text,
  subscription_current_period_end timestamptz,
  subscription_cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `create table if not exists` does not reconcile an older manually-created
-- table. Add every nullable column used by the indexes below before creating
-- those indexes, without rewriting or otherwise mutating existing rows.
alter table public.users
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text;

create index if not exists users_email_idx on public.users (email);
create unique index if not exists users_stripe_subscription_id_key
  on public.users (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists users_stripe_price_id_idx
  on public.users (stripe_price_id)
  where stripe_price_id is not null;

alter table public.users enable row level security;
revoke all on table public.users from public, anon, authenticated;
grant select, insert, update, delete on table public.users to service_role;

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_url text not null,
  result jsonb not null,
  reconstruction jsonb,
  reconstruction_created_at timestamptz,
  reconstruction_plan_used text
    check (reconstruction_plan_used in ('pro', 'lifetime', 'scale')),
  created_at timestamptz not null default now()
);

-- The legacy project may already have `analyses` without its reconstruction
-- columns. Keep the baseline replayable before the later alignment migration.
alter table public.analyses
  add column if not exists reconstruction jsonb,
  add column if not exists reconstruction_created_at timestamptz;

create index if not exists analyses_user_created_idx
  on public.analyses (user_id, created_at desc);
create index if not exists analyses_reconstruction_user_created_idx
  on public.analyses (user_id, reconstruction_created_at desc)
  where reconstruction is not null;

alter table public.analyses enable row level security;
revoke all on table public.analyses from public, anon, authenticated;
grant select on table public.analyses to authenticated;
grant select, insert, update, delete on table public.analyses to service_role;

drop policy if exists "Users can read own analyses" on public.analyses;
create policy "Users can read own analyses"
  on public.analyses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
