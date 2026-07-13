-- TikTok Growth OS - multi-account model, video sync and recommendation cache.
-- This migration is additive and keeps the legacy TikTok columns on public.users intact.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.tiktok_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tiktok_open_id TEXT NOT NULL,
  tiktok_union_id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  username TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tiktok_open_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS tiktok_accounts_open_id_unique
  ON public.tiktok_accounts (tiktok_open_id);

CREATE INDEX IF NOT EXISTS tiktok_accounts_user_status_idx
  ON public.tiktok_accounts (user_id, status);

CREATE TABLE IF NOT EXISTS public.tiktok_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tiktok_account_id UUID NOT NULL REFERENCES public.tiktok_accounts(id) ON DELETE CASCADE,
  tiktok_video_id TEXT NOT NULL,
  title TEXT,
  caption TEXT,
  cover_url TEXT,
  share_url TEXT,
  duration INTEGER,
  create_time TIMESTAMPTZ,
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  share_count BIGINT NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(10, 6) NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tiktok_account_id, tiktok_video_id)
);

CREATE INDEX IF NOT EXISTS tiktok_videos_user_created_idx
  ON public.tiktok_videos (user_id, create_time DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS tiktok_videos_account_synced_idx
  ON public.tiktok_videos (tiktok_account_id, synced_at DESC);

CREATE TABLE IF NOT EXISTS public.tiktok_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tiktok_account_id UUID NOT NULL REFERENCES public.tiktok_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  videos_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS tiktok_sync_runs_account_started_idx
  ON public.tiktok_sync_runs (tiktok_account_id, started_at DESC);

DROP TRIGGER IF EXISTS tiktok_accounts_updated_at ON public.tiktok_accounts;
CREATE TRIGGER tiktok_accounts_updated_at
  BEFORE UPDATE ON public.tiktok_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tiktok_videos_updated_at ON public.tiktok_videos;
CREATE TRIGGER tiktok_videos_updated_at
  BEFORE UPDATE ON public.tiktok_videos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.tiktok_accounts;
DROP POLICY IF EXISTS "Service role full access" ON public.tiktok_videos;
DROP POLICY IF EXISTS "Service role full access" ON public.tiktok_sync_runs;

CREATE POLICY "Service role full access"
  ON public.tiktok_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access"
  ON public.tiktok_videos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access"
  ON public.tiktok_sync_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.tiktok_accounts IS 'Connected TikTok accounts for the Growth OS. Tokens are server-only and must never be exposed to clients.';
COMMENT ON COLUMN public.tiktok_accounts.access_token IS 'Encrypted or service-secured OAuth access token; server only.';
COMMENT ON COLUMN public.tiktok_accounts.refresh_token IS 'Encrypted or service-secured OAuth refresh token; server only.';
