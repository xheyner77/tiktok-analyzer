-- Atomically enforce the per-user TikTok account limit and persist the OAuth
-- grant. The user row is the serialization point: concurrent callbacks for
-- the same Viralynz user cannot both observe the same remaining slot.
--
-- `p_account_limit = null` is supported for a future unlimited tier. Current
-- product limits remain defined by the server-side TypeScript plan matrix.
create or replace function public.upsert_tiktok_account_with_limit(
  p_user_id uuid,
  p_account_limit integer,
  p_tiktok_open_id text,
  p_tiktok_union_id text,
  p_display_name text,
  p_avatar_url text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_refresh_expires_at timestamptz,
  p_scopes text[],
  p_environment text
)
returns table(
  account_id uuid,
  allowed boolean,
  current_count integer,
  limit_value integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_current integer;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user_id_required';
  end if;

  if nullif(btrim(p_tiktok_open_id), '') is null then
    raise exception using errcode = '22023', message = 'tiktok_open_id_required';
  end if;

  if nullif(btrim(p_access_token), '') is null then
    raise exception using errcode = '22023', message = 'access_token_required';
  end if;

  if p_account_limit is not null and p_account_limit < 0 then
    raise exception using errcode = '22023', message = 'invalid_account_limit';
  end if;

  -- A row lock is transaction-scoped and serializes only this Viralynz user.
  perform 1
  from public.users as u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'user_not_found';
  end if;

  -- Reconnecting the same open_id never consumes a second slot. Revoked and
  -- expired rows are also excluded because only active connections count.
  select count(*)::integer
  into v_current
  from public.tiktok_accounts as a
  where a.user_id = p_user_id
    and a.status = 'active'
    and a.tiktok_open_id is distinct from p_tiktok_open_id;

  if p_account_limit is not null and v_current >= p_account_limit then
    return query select null::uuid, false, v_current, p_account_limit;
    return;
  end if;

  insert into public.tiktok_accounts as a (
    user_id,
    tiktok_open_id,
    tiktok_union_id,
    display_name,
    avatar_url,
    username,
    access_token,
    refresh_token,
    expires_at,
    refresh_expires_at,
    scopes,
    environment,
    connected_at,
    last_sync_at,
    sync_status,
    sync_error,
    status
  ) values (
    p_user_id,
    p_tiktok_open_id,
    p_tiktok_union_id,
    p_display_name,
    p_avatar_url,
    null,
    p_access_token,
    p_refresh_token,
    p_expires_at,
    p_refresh_expires_at,
    coalesce(p_scopes, '{}'::text[]),
    coalesce(nullif(btrim(p_environment), ''), 'unknown'),
    now(),
    null,
    'connected',
    null,
    'active'
  )
  on conflict (user_id, tiktok_open_id) do update
  set
    tiktok_union_id = excluded.tiktok_union_id,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    username = excluded.username,
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at,
    refresh_expires_at = excluded.refresh_expires_at,
    scopes = excluded.scopes,
    environment = excluded.environment,
    connected_at = excluded.connected_at,
    last_sync_at = excluded.last_sync_at,
    sync_status = excluded.sync_status,
    sync_error = excluded.sync_error,
    status = excluded.status
  returning a.id into v_account_id;

  select count(*)::integer
  into v_current
  from public.tiktok_accounts as a
  where a.user_id = p_user_id
    and a.status = 'active';

  return query select v_account_id, true, v_current, p_account_limit;
end;
$$;

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

comment on function public.upsert_tiktok_account_with_limit(
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
) is 'Server-only atomic TikTok account limit enforcement and encrypted OAuth grant upsert.';
