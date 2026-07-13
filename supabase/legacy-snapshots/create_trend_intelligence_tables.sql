-- Trend Intelligence pipeline: collecte -> stockage -> clustering -> scoring -> recommandations.
-- Tables publiques avec RLS active. Les ecritures passent par le serveur Viralynz (service_role).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_trend_intelligence_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.trend_scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'success', 'failed')),
  provider TEXT NOT NULL,
  countries TEXT[] NOT NULL DEFAULT '{}',
  niches TEXT[] NOT NULL DEFAULT '{}',
  queries TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error TEXT,
  items_fetched INT NOT NULL DEFAULT 0,
  clusters_created INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.trend_raw_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_item_id TEXT,
  source_url TEXT,
  country TEXT,
  language TEXT,
  query TEXT,
  source_type TEXT,
  caption TEXT,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  sound_id TEXT,
  sound_name TEXT,
  author_id TEXT,
  author_username TEXT,
  author_followers INT,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  views INT NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  duration_seconds INT,
  cover_url TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(provider, provider_item_id)
);

CREATE TABLE IF NOT EXISTS public.trend_clusters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  cluster_type TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  niche TEXT,
  country TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  sample_size INT NOT NULL DEFAULT 0,
  unique_creators INT NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  top_hashtags TEXT[] NOT NULL DEFAULT '{}',
  top_sounds TEXT[] NOT NULL DEFAULT '{}',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trend_cluster_items (
  cluster_id TEXT NOT NULL REFERENCES public.trend_clusters(id) ON DELETE CASCADE,
  raw_item_id UUID NOT NULL REFERENCES public.trend_raw_items(id) ON DELETE CASCADE,
  similarity_score NUMERIC,
  PRIMARY KEY(cluster_id, raw_item_id)
);

CREATE TABLE IF NOT EXISTS public.trend_user_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  niches TEXT[] NOT NULL DEFAULT '{}',
  countries TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  competitors TEXT[] NOT NULL DEFAULT '{}',
  excluded_terms TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trend_user_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cluster_id TEXT REFERENCES public.trend_clusters(id) ON DELETE SET NULL,
  verdict TEXT,
  reason TEXT,
  recommended_hook TEXT,
  recommended_angle TEXT,
  recommended_format TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trend_raw_items_provider_item_idx ON public.trend_raw_items(provider_item_id);
CREATE INDEX IF NOT EXISTS trend_raw_items_fetched_at_idx ON public.trend_raw_items(fetched_at DESC);
CREATE INDEX IF NOT EXISTS trend_raw_items_country_idx ON public.trend_raw_items(country);
CREATE INDEX IF NOT EXISTS trend_raw_items_query_idx ON public.trend_raw_items(query);
CREATE INDEX IF NOT EXISTS trend_clusters_updated_at_idx ON public.trend_clusters(updated_at DESC);
CREATE INDEX IF NOT EXISTS trend_clusters_niche_idx ON public.trend_clusters(niche);
CREATE INDEX IF NOT EXISTS trend_clusters_country_idx ON public.trend_clusters(country);
CREATE INDEX IF NOT EXISTS trend_clusters_pattern_key_idx ON public.trend_clusters(pattern_key);
CREATE INDEX IF NOT EXISTS trend_scan_jobs_started_at_idx ON public.trend_scan_jobs(started_at DESC);
CREATE INDEX IF NOT EXISTS trend_scan_jobs_user_id_idx ON public.trend_scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS trend_cluster_items_raw_item_id_idx ON public.trend_cluster_items(raw_item_id);
CREATE INDEX IF NOT EXISTS trend_user_watchlists_user_idx ON public.trend_user_watchlists(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS trend_user_recommendations_user_idx ON public.trend_user_recommendations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trend_user_recommendations_cluster_id_idx ON public.trend_user_recommendations(cluster_id);

DROP TRIGGER IF EXISTS trend_clusters_updated_at ON public.trend_clusters;
CREATE TRIGGER trend_clusters_updated_at
  BEFORE UPDATE ON public.trend_clusters
  FOR EACH ROW EXECUTE FUNCTION public.set_trend_intelligence_updated_at();

DROP TRIGGER IF EXISTS trend_user_watchlists_updated_at ON public.trend_user_watchlists;
CREATE TRIGGER trend_user_watchlists_updated_at
  BEFORE UPDATE ON public.trend_user_watchlists
  FOR EACH ROW EXECUTE FUNCTION public.set_trend_intelligence_updated_at();

ALTER TABLE public.trend_scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_raw_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_cluster_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_user_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_user_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.trend_scan_jobs;
DROP POLICY IF EXISTS "Service role full access" ON public.trend_raw_items;
DROP POLICY IF EXISTS "Service role full access" ON public.trend_clusters;
DROP POLICY IF EXISTS "Service role full access" ON public.trend_cluster_items;
DROP POLICY IF EXISTS "Service role full access" ON public.trend_user_watchlists;
DROP POLICY IF EXISTS "Service role full access" ON public.trend_user_recommendations;

CREATE POLICY "Service role full access" ON public.trend_scan_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.trend_raw_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.trend_clusters FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.trend_cluster_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.trend_user_watchlists FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.trend_user_recommendations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can read trend clusters" ON public.trend_clusters;
CREATE POLICY "Authenticated can read trend clusters"
  ON public.trend_clusters
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can manage own trend watchlist" ON public.trend_user_watchlists;
CREATE POLICY "Users can manage own trend watchlist"
  ON public.trend_user_watchlists
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own trend scan jobs" ON public.trend_scan_jobs;
CREATE POLICY "Users can read own trend scan jobs"
  ON public.trend_scan_jobs
  FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own trend recommendations" ON public.trend_user_recommendations;
CREATE POLICY "Users can manage own trend recommendations"
  ON public.trend_user_recommendations
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.trend_raw_items IS 'Raw public TikTok items fetched by server-side trend providers. No API token is stored here.';
COMMENT ON TABLE public.trend_clusters IS 'Normalized trend clusters with evidence, calculated scores and recommendation payload.';
