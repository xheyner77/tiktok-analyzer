-- Fix hooks_history : la FK pointait sur auth.users au lieu de public.users,
-- ce qui faisait échouer silencieusement tous les INSERT (les UUIDs de public.users
-- n'existent pas dans auth.users).

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE public.hooks_history
  DROP CONSTRAINT IF EXISTS hooks_history_user_id_fkey;

-- 2. La recréer sur public.users
ALTER TABLE public.hooks_history
  ADD CONSTRAINT hooks_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 3. S'assurer que le service_role peut tout faire (insert / select / update / delete)
DROP POLICY IF EXISTS "Service role full access" ON public.hooks_history;
CREATE POLICY "Service role full access"
  ON public.hooks_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
