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
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 4. Atomic analyses counter increment
--    Called by the server via supabase.rpc('increment_analyses_count', { user_id })
CREATE OR REPLACE FUNCTION public.increment_analyses_count(user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER AS $$
  UPDATE public.users
  SET analyses_count = analyses_count + 1
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.reserve_analysis_quota(p_user_id UUID, p_limit INT)
RETURNS TABLE(allowed BOOLEAN, used INT, limit_value INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 THEN
    RAISE EXCEPTION 'p_limit must be a positive integer';
  END IF;

  UPDATE public.users
  SET analyses_count = analyses_count + 1
  WHERE id = p_user_id
    AND analyses_count < p_limit
  RETURNING analyses_count INTO updated_count;

  IF updated_count IS NULL THEN
    SELECT analyses_count INTO updated_count
    FROM public.users
    WHERE id = p_user_id;

    RETURN QUERY SELECT false, COALESCE(updated_count, 0), p_limit;
  ELSE
    RETURN QUERY SELECT true, updated_count, p_limit;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_analysis_quota(p_user_id UUID)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
  SET analyses_count = GREATEST(analyses_count - 1, 0)
  WHERE id = p_user_id
  RETURNING analyses_count;
$$;

CREATE OR REPLACE FUNCTION public.increment_reconstructions_count_by(p_user_id UUID, p_amount INT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER AS $$
  UPDATE public.users
  SET reconstructions_count = reconstructions_count + GREATEST(1, p_amount)
  WHERE id = p_user_id;
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
