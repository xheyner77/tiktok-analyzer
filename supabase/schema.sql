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
  password_hash  TEXT        NOT NULL,
  plan           TEXT        NOT NULL DEFAULT 'free'
                             CHECK (plan IN ('free', 'pro', 'elite')),
  analyses_count INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast email look-ups
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);


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
