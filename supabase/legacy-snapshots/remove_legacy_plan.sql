UPDATE public.users
SET plan = 'scale'
WHERE plan = 'el' || 'ite';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_plan_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'creator', 'pro', 'scale'));
