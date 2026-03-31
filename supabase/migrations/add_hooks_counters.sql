-- ============================================================
--  Migration: add hook generator counters + monthly reset
--  Run this in Supabase → SQL Editor
-- ============================================================

-- 1. New columns on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hooks_count    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reset_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Reset monthly counters (called server-side when a new month is detected)
CREATE OR REPLACE FUNCTION public.reset_monthly_counters(user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER AS $$
  UPDATE public.users
  SET analyses_count = 0,
      hooks_count    = 0,
      last_reset_at  = NOW()
  WHERE id = user_id;
$$;

-- 3. Atomic hook counter increment
CREATE OR REPLACE FUNCTION public.increment_hooks_count(user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER AS $$
  UPDATE public.users
  SET hooks_count = hooks_count + 1
  WHERE id = user_id;
$$;
