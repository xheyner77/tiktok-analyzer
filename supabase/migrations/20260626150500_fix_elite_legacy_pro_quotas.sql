-- Align legacy Elite Stripe access with Pro quotas.
-- Idempotent and non-destructive: replaces quota helper/RPC functions only.

CREATE OR REPLACE FUNCTION public.quota_analysis_limit_for_plan(
  p_plan text,
  p_subscription_status text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_plan = 'free' THEN 3
    WHEN p_plan IN ('starter', 'creator') THEN 30
    WHEN p_plan = 'pro' THEN 150
    WHEN p_plan IN ('lifetime', 'scale') THEN 2147483647
    WHEN p_plan = 'elite'
      AND p_subscription_status IN ('active', 'trialing')
      AND NULLIF(BTRIM(p_stripe_subscription_id), '') IS NOT NULL
      THEN 150
    ELSE 3
  END;
$$;

CREATE OR REPLACE FUNCTION public.quota_hook_limit_for_plan(
  p_plan text,
  p_subscription_status text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_plan = 'free' THEN 0
    WHEN p_plan IN ('starter', 'creator') THEN 50
    WHEN p_plan = 'pro' THEN 250
    WHEN p_plan IN ('lifetime', 'scale') THEN 2147483647
    WHEN p_plan = 'elite'
      AND p_subscription_status IN ('active', 'trialing')
      AND NULLIF(BTRIM(p_stripe_subscription_id), '') IS NOT NULL
      THEN 250
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.quota_reconstruction_limit_for_plan(
  p_plan text,
  p_subscription_status text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_plan IN ('pro', 'lifetime', 'scale') THEN 30
    WHEN p_plan = 'elite'
      AND p_subscription_status IN ('active', 'trialing')
      AND NULLIF(BTRIM(p_stripe_subscription_id), '') IS NOT NULL
      THEN 30
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_analysis_quota(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS TABLE(allowed boolean, used integer, limit_value integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan text;
  v_subscription_status text;
  v_stripe_subscription_id text;
  v_current integer;
  v_limit integer;
  v_amount integer := GREATEST(1, COALESCE(p_amount, 1));
BEGIN
  SELECT
    u.plan,
    u.subscription_status,
    u.stripe_subscription_id,
    u.analyses_count
  INTO
    v_plan,
    v_subscription_status,
    v_stripe_subscription_id,
    v_current
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  v_limit := public.quota_analysis_limit_for_plan(v_plan, v_subscription_status, v_stripe_subscription_id);

  IF v_current + v_amount > v_limit THEN
    RETURN QUERY SELECT false, v_current, v_limit;
    RETURN;
  END IF;

  UPDATE public.users AS u
  SET analyses_count = u.analyses_count + v_amount
  WHERE u.id = p_user_id
  RETURNING u.analyses_count INTO v_current;

  RETURN QUERY SELECT true, v_current, v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_reconstruction_quota(p_user_id uuid, p_amount integer DEFAULT 1)
RETURNS TABLE(allowed boolean, used integer, limit_value integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan text;
  v_subscription_status text;
  v_stripe_subscription_id text;
  v_current integer;
  v_limit integer;
  v_amount integer := GREATEST(1, COALESCE(p_amount, 1));
BEGIN
  SELECT
    u.plan,
    u.subscription_status,
    u.stripe_subscription_id,
    u.reconstructions_count
  INTO
    v_plan,
    v_subscription_status,
    v_stripe_subscription_id,
    v_current
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  v_limit := public.quota_reconstruction_limit_for_plan(v_plan, v_subscription_status, v_stripe_subscription_id);

  IF v_current + v_amount > v_limit THEN
    RETURN QUERY SELECT false, v_current, v_limit;
    RETURN;
  END IF;

  UPDATE public.users AS u
  SET reconstructions_count = u.reconstructions_count + v_amount
  WHERE u.id = p_user_id
  RETURNING u.reconstructions_count INTO v_current;

  RETURN QUERY SELECT true, v_current, v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.quota_analysis_limit_for_plan(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quota_hook_limit_for_plan(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quota_reconstruction_limit_for_plan(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_analysis_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_reconstruction_quota(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.quota_analysis_limit_for_plan(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quota_hook_limit_for_plan(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quota_reconstruction_limit_for_plan(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_analysis_quota(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_reconstruction_quota(uuid, integer) TO service_role;
