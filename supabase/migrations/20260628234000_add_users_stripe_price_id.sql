-- Store the Stripe Price ID that granted the current billing state.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

CREATE INDEX IF NOT EXISTS users_stripe_price_id_idx
  ON public.users (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;
