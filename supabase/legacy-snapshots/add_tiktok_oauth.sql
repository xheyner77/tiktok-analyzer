-- TikTok Login Kit (OAuth) — lier le compte TikTok au compte Viralynz
-- Exécuter dans le SQL Editor Supabase après déploiement du code.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tiktok_open_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_union_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_display_name TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_access_token TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tiktok_connected_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_tiktok_open_id_key
  ON public.users (tiktok_open_id)
  WHERE tiktok_open_id IS NOT NULL;

COMMENT ON COLUMN public.users.tiktok_access_token IS 'OAuth user access token — server only, never expose to client';
COMMENT ON COLUMN public.users.tiktok_refresh_token IS 'OAuth refresh token — server only';
