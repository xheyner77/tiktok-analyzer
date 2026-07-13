-- Scale was a recurring legacy subscription. Lifetime is permanent only when
-- the canonical webhook marker is present. Keep these helpers aligned with
-- lib/stripe-billing.ts so a stale/corrupted raw plan fails closed.

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
    when p_plan = 'lifetime'
      and p_subscription_status = 'lifetime'
      then 2147483647
    when p_plan = 'scale'
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      and p_subscription_status in ('active', 'trialing')
      then 2147483647
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
    when p_plan = 'lifetime'
      and p_subscription_status = 'lifetime'
      then 2147483647
    when p_plan = 'scale'
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      and p_subscription_status in ('active', 'trialing')
      then 2147483647
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
    when p_plan = 'lifetime'
      and p_subscription_status = 'lifetime'
      then 30
    when p_plan = 'scale'
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      and p_subscription_status in ('active', 'trialing')
      then 30
    when p_plan = 'elite'
      and p_subscription_status in ('active', 'trialing')
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      then 30
    else 0
  end;
$$;
