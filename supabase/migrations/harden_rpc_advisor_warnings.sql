-- Harden Supabase Advisor RPC warnings without changing app behavior.
--
-- Scope:
-- - Keep existing RPC names and signatures.
-- - Preserve current counter/reset logic.
-- - Remove anon/authenticated execution from sensitive SECURITY DEFINER RPCs.
-- - Pin search_path to an empty path and use explicit public.* references.

create or replace function public.increment_hooks_count(user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users
  set hooks_count = public.users.hooks_count + 1
  where public.users.id = $1;
$$;

revoke all on function public.increment_hooks_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_hooks_count(uuid) to service_role;

create or replace function public.increment_hooks_count_by(p_user_id uuid, p_amount integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users
  set hooks_count = public.users.hooks_count + greatest(1, $2)
  where public.users.id = $1;
$$;

revoke all on function public.increment_hooks_count_by(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_hooks_count_by(uuid, integer) to service_role;

create or replace function public.reset_monthly_counters(user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users
  set analyses_count = 0,
      hooks_count = 0,
      last_reset_at = now()
  where public.users.id = $1;
$$;

revoke all on function public.reset_monthly_counters(uuid) from public, anon, authenticated;
grant execute on function public.reset_monthly_counters(uuid) to service_role;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_updated_at() from public, anon, authenticated;

-- This helper exists in the remote Advisor output but is not defined in this repo.
-- Harden it only when present so local/staging databases without it do not fail.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
    alter function public.rls_auto_enable() set search_path = '';
  end if;
end;
$$;
