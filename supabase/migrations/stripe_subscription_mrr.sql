-- Stripe subscription (MRR) — colonnes sur public.users
-- Exécuter dans Supabase SQL Editor (ou via migration) AVANT le déploiement des routes subscription.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- Un abonnement Stripe ne doit être lié qu’à un seul compte app
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_key
  ON public.users (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx
  ON public.users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
