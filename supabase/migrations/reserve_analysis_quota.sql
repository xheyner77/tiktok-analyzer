-- Reserve one analysis quota slot atomically.
-- This prevents concurrent requests from passing a separate read-then-increment check.
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

REVOKE ALL ON FUNCTION public.reserve_analysis_quota(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_analysis_quota(UUID, INT) TO service_role;
