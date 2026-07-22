-- Lifetime keeps its one-time commercial entitlement, but its operational
-- analysis and hook windows now use the same finite monthly guardrails as Pro.
-- Historical creator/scale values remain internal compatibility aliases.

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
      then 150
    when p_plan = 'scale'
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      and p_subscription_status in ('active', 'trialing')
      then 150
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
      then 250
    when p_plan = 'scale'
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      and p_subscription_status in ('active', 'trialing')
      then 250
    when p_plan = 'elite'
      and p_subscription_status in ('active', 'trialing')
      and nullif(btrim(p_stripe_subscription_id), '') is not null
      then 250
    else 0
  end;
$$;

revoke all on function public.quota_analysis_limit_for_plan(text, text, text)
  from public, anon, authenticated;
revoke all on function public.quota_hook_limit_for_plan(text, text, text)
  from public, anon, authenticated;
grant execute on function public.quota_analysis_limit_for_plan(text, text, text)
  to service_role;
grant execute on function public.quota_hook_limit_for_plan(text, text, text)
  to service_role;
