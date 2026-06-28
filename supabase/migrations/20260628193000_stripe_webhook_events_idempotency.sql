-- Stripe webhook idempotency.
-- Stores each Stripe event before handler execution so retries can be safely acked or resumed.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_created_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1
    CHECK (attempts >= 1),
  last_error TEXT,
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_status_updated_at_idx
  ON public.stripe_webhook_events (status, updated_at);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.stripe_webhook_events;

CREATE POLICY "Service role full access"
  ON public.stripe_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS stripe_webhook_events_updated_at ON public.stripe_webhook_events;

CREATE TRIGGER stripe_webhook_events_updated_at
  BEFORE UPDATE ON public.stripe_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_stripe_created_at TIMESTAMPTZ,
  p_stale_before TIMESTAMPTZ
)
RETURNS TABLE(action TEXT, status TEXT, attempts INTEGER)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  existing_event public.stripe_webhook_events%ROWTYPE;
BEGIN
  INSERT INTO public.stripe_webhook_events (
    event_id,
    event_type,
    stripe_created_at,
    status,
    attempts,
    processing_started_at
  )
  VALUES (
    p_event_id,
    p_event_type,
    p_stripe_created_at,
    'processing',
    1,
    NOW()
  )
  ON CONFLICT (event_id) DO NOTHING;

  IF FOUND THEN
    RETURN QUERY SELECT 'process_new'::TEXT, 'processing'::TEXT, 1::INTEGER;
    RETURN;
  END IF;

  SELECT *
    INTO existing_event
    FROM public.stripe_webhook_events
    WHERE event_id = p_event_id
    FOR UPDATE;

  IF existing_event.status = 'processed' THEN
    RETURN QUERY SELECT 'duplicate_processed'::TEXT, existing_event.status, existing_event.attempts;
    RETURN;
  END IF;

  IF existing_event.status = 'processing' AND existing_event.updated_at >= p_stale_before THEN
    RETURN QUERY SELECT 'duplicate_processing'::TEXT, existing_event.status, existing_event.attempts;
    RETURN;
  END IF;

  IF existing_event.status = 'processing' THEN
    UPDATE public.stripe_webhook_events
      SET
        event_type = p_event_type,
        stripe_created_at = COALESCE(stripe_created_at, p_stripe_created_at),
        attempts = attempts + 1,
        processing_started_at = NOW(),
        last_error = NULL
      WHERE event_id = p_event_id
      RETURNING * INTO existing_event;

    RETURN QUERY SELECT 'process_retry_stale'::TEXT, existing_event.status, existing_event.attempts;
    RETURN;
  END IF;

  IF existing_event.status = 'failed' THEN
    UPDATE public.stripe_webhook_events
      SET
        event_type = p_event_type,
        stripe_created_at = COALESCE(stripe_created_at, p_stripe_created_at),
        status = 'processing',
        attempts = attempts + 1,
        processing_started_at = NOW(),
        last_error = NULL
      WHERE event_id = p_event_id
      RETURNING * INTO existing_event;

    RETURN QUERY SELECT 'process_retry_failed'::TEXT, existing_event.status, existing_event.attempts;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'duplicate_processing'::TEXT, existing_event.status, existing_event.attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
