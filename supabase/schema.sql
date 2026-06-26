-- ============================================================
--  TikTok Analyzer — Supabase schema
--  Run this in the Supabase SQL editor (Project > SQL Editor)
-- ============================================================

-- 1. Extension UUID (already enabled on most Supabase projects)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- 2. Users table
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        UNIQUE NOT NULL,
  password_hash  TEXT,
  plan           TEXT        NOT NULL DEFAULT 'free'
                             CHECK (plan IN ('free', 'creator', 'pro', 'scale')),
  analyses_count INTEGER     NOT NULL DEFAULT 0,
  hooks_count    INTEGER     NOT NULL DEFAULT 0,
  reconstructions_count INTEGER NOT NULL DEFAULT 0,
  last_reset_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stripe_customer_id              TEXT,
  stripe_subscription_id          TEXT,
  subscription_status             TEXT,
  subscription_current_period_end TIMESTAMPTZ,
  subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast email look-ups
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_key
  ON public.users (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;


-- 3. Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 4. Quota helpers and atomic counter RPCs
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

CREATE OR REPLACE FUNCTION public.increment_analyses_count(user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.users
  SET analyses_count = analyses_count + 1
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.reserve_analysis_quota(p_user_id UUID, p_amount INTEGER DEFAULT 1)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, limit_value INTEGER)
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

CREATE OR REPLACE FUNCTION public.refund_analysis_quota(p_user_id UUID)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.users
  SET analyses_count = GREATEST(analyses_count - 1, 0)
  WHERE id = p_user_id
  RETURNING analyses_count;
$$;

CREATE OR REPLACE FUNCTION public.increment_reconstructions_count_by(p_user_id UUID, p_amount INT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.users
  SET reconstructions_count = reconstructions_count + GREATEST(1, p_amount)
  WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.reserve_reconstruction_quota(p_user_id UUID, p_amount INTEGER DEFAULT 1)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, limit_value INTEGER)
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


-- 5. Row Level Security
--    All writes come from the server using the service-role key,
--    so we only need a permissive policy for that role.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to make this script re-runnable
DROP POLICY IF EXISTS "Service role full access" ON public.users;

CREATE POLICY "Service role full access"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- TikTok OAuth (Login Kit) — voir migrations/add_tiktok_oauth.sql pour ALTER TABLE
-- colonnes : tiktok_open_id, tiktok_union_id, tiktok_display_name, tiktok_avatar_url,
--            tiktok_access_token, tiktok_refresh_token, tiktok_token_expires_at, tiktok_connected_at

-- Creator Memory â€” voir migrations/creator_memory_profiles.sql
CREATE TABLE IF NOT EXISTS public.creator_memory_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'creator', 'pro', 'scale')),
  memory_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  prompt_context TEXT NOT NULL DEFAULT '',
  source_analysis_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.video_analysis_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
  video_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'creator', 'pro', 'scale')),
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(4, 3) NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
