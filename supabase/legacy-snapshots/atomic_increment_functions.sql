-- ============================================================
--  MIGRATION : Fonctions d'incrémentation atomiques
--  À exécuter dans Supabase → SQL Editor
--
--  PROBLÈME CORRIGÉ :
--  Les anciennes fonctions `incrementAnalysesCount` et
--  `incrementHooksCount` utilisaient un pattern read-then-write
--  (fetch count → update count+N) qui permettait de contourner
--  les quotas via des requêtes concurrentes (race condition).
--
--  SOLUTION :
--  On utilise des UPDATE directs en SQL (SET count = count + N)
--  qui sont atomiques au niveau de la ligne grâce au verrouillage
--  implicite de PostgreSQL sur UPDATE.
-- ============================================================

-- 1. Incrément analyses_count (déjà existant, préservé tel quel)
CREATE OR REPLACE FUNCTION public.increment_analyses_count(user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER AS $$
  UPDATE public.users
  SET analyses_count = analyses_count + 1
  WHERE id = user_id;
$$;

-- 2. Incrément hooks_count de 1 (compatibilité avec l'ancienne signature)
CREATE OR REPLACE FUNCTION public.increment_hooks_count(user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER AS $$
  UPDATE public.users
  SET hooks_count = hooks_count + 1
  WHERE id = user_id;
$$;

-- 3. Incrément hooks_count par N (NOUVELLE FONCTION pour les générations en lot)
--    Utilisée par lib/auth.ts → incrementHooksCount(userId, consumed)
CREATE OR REPLACE FUNCTION public.increment_hooks_count_by(p_user_id UUID, p_amount INT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER AS $$
  UPDATE public.users
  SET hooks_count = hooks_count + GREATEST(1, p_amount)
  WHERE id = p_user_id;
$$;
