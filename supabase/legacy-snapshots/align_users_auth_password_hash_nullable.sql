-- Align public.users with Supabase Auth.
-- Passwords are managed by Supabase Auth, so the legacy password_hash column
-- must not block profile creation/upserts that do not provide it.

ALTER TABLE public.users
  ALTER COLUMN password_hash DROP NOT NULL;
