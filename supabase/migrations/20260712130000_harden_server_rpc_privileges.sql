-- Keep quota and counter RPCs callable only by Viralynz server code.
--
-- SECURITY DEFINER functions inherit EXECUTE for PUBLIC unless it is revoked.
-- Several historical migrations created different overloads, so this migration
-- hardens every currently installed signature instead of assuming one shape.

-- Paid recurring plans linked to Stripe only keep paid quotas while the
-- subscription is active. Rows without a Stripe subscription id are retained
-- as explicit legacy/grandfathered accounts. Lifetime is a one-time purchase
-- and therefore does not depend on subscription_status.
create or replace function public.quota_analysis_limit_for_plan(
  p_plan text,
  p_subscription_status text default null,
  p_stripe_subscription_id text default null
)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when p_plan = 'free' then 3
    when p_plan in ('starter', 'creator')
      and (
        nullif(btrim(p_stripe_subscription_id), '') is null
        or p_subscription_status in ('active', 'trialing')
      )
      then 30
    when p_plan = 'pro'
      and (
        nullif(btrim(p_stripe_subscription_id), '') is null
        or p_subscription_status in ('active', 'trialing')
      )
      then 150
    when p_plan in ('lifetime', 'scale') then 2147483647
    when p_plan = 'elite'
      and p_subscription_status in ('active', 'trialing')
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      then 150
    else 3
  end;
$$;

create or replace function public.quota_hook_limit_for_plan(
  p_plan text,
  p_subscription_status text default null,
  p_stripe_subscription_id text default null
)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when p_plan = 'free' then 0
    when p_plan in ('starter', 'creator')
      and (
        nullif(btrim(p_stripe_subscription_id), '') is null
        or p_subscription_status in ('active', 'trialing')
      )
      then 50
    when p_plan = 'pro'
      and (
        nullif(btrim(p_stripe_subscription_id), '') is null
        or p_subscription_status in ('active', 'trialing')
      )
      then 250
    when p_plan in ('lifetime', 'scale') then 2147483647
    when p_plan = 'elite'
      and p_subscription_status in ('active', 'trialing')
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      then 250
    else 0
  end;
$$;

create or replace function public.quota_reconstruction_limit_for_plan(
  p_plan text,
  p_subscription_status text default null,
  p_stripe_subscription_id text default null
)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when p_plan = 'pro'
      and (
        nullif(btrim(p_stripe_subscription_id), '') is null
        or p_subscription_status in ('active', 'trialing')
      )
      then 30
    when p_plan in ('lifetime', 'scale') then 30
    when p_plan = 'elite'
      and p_subscription_status in ('active', 'trialing')
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      then 30
    else 0
  end;
$$;

-- Replace exact signatures instead of renaming historical IN parameters via
-- CREATE OR REPLACE (which PostgreSQL rejects).
drop function if exists public.reserve_analysis_quota(uuid, integer);

create function public.reserve_analysis_quota(
  p_user_id uuid,
  p_amount integer default 1
)
returns table(allowed boolean, used integer, limit_value integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_subscription_status text;
  v_stripe_subscription_id text;
  v_current integer;
  v_limit integer;
  v_amount integer := greatest(1, coalesce(p_amount, 1));
begin
  select
    u.plan,
    u.subscription_status,
    u.stripe_subscription_id,
    u.analyses_count
  into
    v_plan,
    v_subscription_status,
    v_stripe_subscription_id,
    v_current
  from public.users as u
  where u.id = p_user_id
  for update;

  if not found then
    return query select false, 0, 0;
    return;
  end if;

  v_limit := public.quota_analysis_limit_for_plan(
    v_plan,
    v_subscription_status,
    v_stripe_subscription_id
  );
  if v_current + v_amount > v_limit then
    return query select false, v_current, v_limit;
    return;
  end if;

  update public.users as u
  set analyses_count = u.analyses_count + v_amount
  where u.id = p_user_id
  returning u.analyses_count into v_current;

  return query select true, v_current, v_limit;
end;
$$;

-- Remove both historical refund overloads. Keeping `(uuid)` alongside
-- `(uuid, integer default 1)` makes a named call with only p_user_id ambiguous.
drop function if exists public.refund_analysis_quota(uuid);
drop function if exists public.refund_analysis_quota(uuid, integer);

create function public.refund_analysis_quota(
  p_user_id uuid,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_amount integer := greatest(1, coalesce(p_amount, 1));
begin
  update public.users as u
  set analyses_count = greatest(u.analyses_count - v_amount, 0)
  where u.id = p_user_id
  returning u.analyses_count into v_next;

  return coalesce(v_next, 0);
end;
$$;

drop function if exists public.reserve_reconstruction_quota(uuid, integer);

create function public.reserve_reconstruction_quota(
  p_user_id uuid,
  p_amount integer default 1
)
returns table(allowed boolean, used integer, limit_value integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_subscription_status text;
  v_stripe_subscription_id text;
  v_current integer;
  v_limit integer;
  v_amount integer := greatest(1, coalesce(p_amount, 1));
begin
  select
    u.plan,
    u.subscription_status,
    u.stripe_subscription_id,
    u.reconstructions_count
  into
    v_plan,
    v_subscription_status,
    v_stripe_subscription_id,
    v_current
  from public.users as u
  where u.id = p_user_id
  for update;

  if not found then
    return query select false, 0, 0;
    return;
  end if;

  v_limit := public.quota_reconstruction_limit_for_plan(
    v_plan,
    v_subscription_status,
    v_stripe_subscription_id
  );
  if v_current + v_amount > v_limit then
    return query select false, v_current, v_limit;
    return;
  end if;

  update public.users as u
  set reconstructions_count = u.reconstructions_count + v_amount
  where u.id = p_user_id
  returning u.reconstructions_count into v_current;

  return query select true, v_current, v_limit;
end;
$$;

drop function if exists public.refund_reconstruction_quota(uuid, integer);

create function public.refund_reconstruction_quota(
  p_user_id uuid,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_amount integer := greatest(1, coalesce(p_amount, 1));
begin
  update public.users as u
  set reconstructions_count = greatest(u.reconstructions_count - v_amount, 0)
  where u.id = p_user_id
  returning u.reconstructions_count into v_next;

  return coalesce(v_next, 0);
end;
$$;

drop function if exists public.reserve_hook_quota(uuid, integer);

create function public.reserve_hook_quota(
  p_user_id uuid,
  p_amount integer default 1
)
returns table(allowed boolean, used integer, limit_value integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_subscription_status text;
  v_stripe_subscription_id text;
  v_current integer;
  v_limit integer;
  v_amount integer := greatest(1, coalesce(p_amount, 1));
begin
  select u.plan, u.subscription_status, u.stripe_subscription_id, u.hooks_count
  into v_plan, v_subscription_status, v_stripe_subscription_id, v_current
  from public.users as u
  where u.id = p_user_id
  for update;

  if not found then
    return query select false, 0, 0;
    return;
  end if;

  v_limit := public.quota_hook_limit_for_plan(v_plan, v_subscription_status, v_stripe_subscription_id);
  if v_current + v_amount > v_limit then
    return query select false, v_current, v_limit;
    return;
  end if;

  update public.users as u
  set hooks_count = u.hooks_count + v_amount
  where u.id = p_user_id
  returning u.hooks_count into v_current;

  return query select true, v_current, v_limit;
end;
$$;

drop function if exists public.refund_hook_quota(uuid, integer);

create function public.refund_hook_quota(
  p_user_id uuid,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_amount integer := greatest(1, coalesce(p_amount, 1));
begin
  update public.users as u
  set hooks_count = greatest(u.hooks_count - v_amount, 0)
  where u.id = p_user_id
  returning u.hooks_count into v_next;

  return coalesce(v_next, 0);
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'increment_analyses_count',
        'increment_hooks_count',
        'increment_hooks_count_by',
        'increment_reconstructions_count_by',
        'quota_analysis_limit_for_plan',
        'quota_hook_limit_for_plan',
        'quota_reconstruction_limit_for_plan',
        'refund_analysis_quota',
        'refund_hook_quota',
        'refund_reconstruction_quota',
        'reserve_analysis_quota',
        'reserve_hook_quota',
        'reserve_reconstruction_quota',
        'reset_monthly_counters'
      ])
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = %L',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments,
      ''
    );
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  end loop;
end;
$$;

-- Trigger helpers do not need direct API execution at all.
do $$
begin
  if to_regprocedure('public.handle_updated_at()') is not null then
    revoke all on function public.handle_updated_at() from public, anon, authenticated;
    alter function public.handle_updated_at() set search_path = '';
  end if;
end;
$$;

-- OAuth tokens are consumed only by server routes using the service role.
-- An owner-scoped SELECT policy is still unsafe here because it exposes the
-- encrypted token ciphertext to browser clients and would expose plaintext
-- legacy rows before their lazy migration.
do $$
begin
  if to_regclass('public.tiktok_accounts') is not null then
    execute 'alter table public.tiktok_accounts enable row level security';
    execute 'revoke all on table public.tiktok_accounts from public, anon, authenticated';
    execute 'grant select, insert, update, delete on table public.tiktok_accounts to service_role';
    execute 'drop policy if exists "Users can read own TikTok accounts" on public.tiktok_accounts';
  end if;
end;
$$;
