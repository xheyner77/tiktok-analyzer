-- Refund one reserved analysis quota slot after a technical failure.
-- This is intentionally service-role only and clamps the counter at zero.
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

REVOKE ALL ON FUNCTION public.refund_analysis_quota(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_analysis_quota(UUID) TO service_role;
