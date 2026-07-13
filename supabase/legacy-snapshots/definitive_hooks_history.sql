-- ============================================================
--  MIGRATION DÉFINITIVE : hooks_history
--  À exécuter dans Supabase → SQL Editor
--
--  PROBLÈME CORRIGÉ :
--  L'ancienne table avait "references auth.users(id)" alors que
--  l'app utilise public.users (auth custom, pas Supabase Auth).
--  => chaque INSERT échouait silencieusement (FK violation).
-- ============================================================

-- 1. Supprimer l'ancienne table (elle est vide car tous les inserts échouaient)
DROP TABLE IF EXISTS public.hooks_history;

-- 2. Recréer proprement avec FK sur public.users
CREATE TABLE public.hooks_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hook_text   TEXT        NOT NULL,
  context     TEXT,
  scene       TEXT,
  person      TEXT,
  tone        TEXT,
  variant_of  TEXT,
  is_favorite BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Index pour les requêtes fréquentes
CREATE INDEX hooks_history_user_created_idx
  ON public.hooks_history (user_id, created_at DESC);

CREATE INDEX hooks_history_user_favorite_idx
  ON public.hooks_history (user_id, is_favorite, created_at DESC);

-- 4. RLS activé + policy service_role full access
ALTER TABLE public.hooks_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.hooks_history;
CREATE POLICY "Service role full access"
  ON public.hooks_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
