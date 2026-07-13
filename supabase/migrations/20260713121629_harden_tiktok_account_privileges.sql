-- Forward-only repair for projects where an older migration may be recorded as
-- applied while browser roles can still read encrypted TikTok OAuth grants.
-- This intentionally fails when the expected table or RPC is absent: a partial
-- schema must be repaired explicitly instead of silently remaining exposed.

alter table public.tiktok_accounts enable row level security;

revoke all on table public.tiktok_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.tiktok_accounts to service_role;

-- Remove every existing policy, including policies with names unknown to this
-- repository, then restore the sole server-side policy.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'tiktok_accounts'
  loop
    execute pg_catalog.format(
      'drop policy %I on public.tiktok_accounts',
      v_policy.policyname
    );
  end loop;
end;
$$;

create policy "Service role full access"
  on public.tiktok_accounts
  for all
  to service_role
  using (true)
  with check (true);

-- The current UUID primary key has no sequence. This also closes privileges on
-- any serial/identity sequence owned by a legacy or future table column.
do $$
declare
  v_sequence record;
begin
  for v_sequence in
    select distinct
      sequence_namespace.nspname as schema_name,
      sequence_class.relname as sequence_name
    from pg_catalog.pg_class as table_class
    join pg_catalog.pg_namespace as table_namespace
      on table_namespace.oid = table_class.relnamespace
    join pg_catalog.pg_depend as dependency
      on dependency.refobjid = table_class.oid
      and dependency.refobjsubid > 0
      and dependency.deptype in ('a', 'i')
      and dependency.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
      and dependency.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass
    join pg_catalog.pg_class as sequence_class
      on sequence_class.oid = dependency.objid
      and sequence_class.relkind = 'S'
    join pg_catalog.pg_namespace as sequence_namespace
      on sequence_namespace.oid = sequence_class.relnamespace
    where table_namespace.nspname = 'public'
      and table_class.relname = 'tiktok_accounts'
      and table_class.relkind in ('r', 'p')
  loop
    execute pg_catalog.format(
      'revoke all on sequence %I.%I from public, anon, authenticated',
      v_sequence.schema_name,
      v_sequence.sequence_name
    );
    execute pg_catalog.format(
      'grant usage, select, update on sequence %I.%I to service_role',
      v_sequence.schema_name,
      v_sequence.sequence_name
    );
  end loop;
end;
$$;

-- Both functions can mutate the protected table or its token-bearing rows.
revoke all on function public.handle_updated_at()
  from public, anon, authenticated;
grant execute on function public.handle_updated_at()
  to service_role;

revoke all on function public.upsert_tiktok_account_with_limit(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text[],
  text
) from public, anon, authenticated;

grant execute on function public.upsert_tiktok_account_with_limit(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text[],
  text
) to service_role;
