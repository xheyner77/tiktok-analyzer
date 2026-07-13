-- Billing entitlements, quota counters and legacy OAuth columns are all
-- server-owned. RLS policies alone are not enough if an existing project has
-- retained authenticated table grants: revoke the Data API privileges too.
--
-- This intentionally lives in its own forward-only migration so it is still
-- applied when an older hardening migration is already present in the remote
-- migration ledger. Missing `public.users` is a hard error: silently marking
-- this migration applied on the wrong/incomplete project would be unsafe.
alter table public.users enable row level security;
revoke all on table public.users from public, anon, authenticated;
grant select, insert, update, delete on table public.users to service_role;
