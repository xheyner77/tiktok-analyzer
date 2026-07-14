-- Durable operational ledger for video-analysis provider calls. Each logical
-- attempt is inserted once and only finalized in place; no retry deletes it.
-- No prompt, response, transcript, URL, API key or other user content belongs
-- in this table. Rows are server-only and survive a partial workflow failure.

create table public.analysis_provider_calls (
  id bigint generated always as identity primary key,
  attempt_id uuid not null,
  job_id uuid not null references public.analysis_jobs(id) on delete cascade,
  call_key text not null,
  stage text not null,
  operation text not null,
  provider text not null default 'openai',
  model text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  billing_status text not null
    check (billing_status in ('billable', 'non_billable', 'unknown')),
  usage_kind text not null
    check (usage_kind in ('tokens', 'audio_seconds', 'none', 'unknown')),
  fallback_index smallint not null default 0 check (fallback_index >= 0),
  retry_index smallint not null default 0 check (retry_index >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cached_input_tokens integer check (cached_input_tokens is null or cached_input_tokens >= 0),
  audio_seconds numeric(12, 3) check (audio_seconds is null or audio_seconds >= 0),
  price_catalog_version text,
  estimated_cost_usd numeric(14, 8)
    check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  error_code text,
  retryable boolean,
  fallback_allowed boolean,
  started_at timestamptz not null,
  lease_owner uuid,
  lease_expires_at timestamptz,
  replay_lease_owner uuid,
  replay_lease_expires_at timestamptz,
  finalized_by uuid,
  ended_at timestamptz,
  wall_ms integer check (wall_ms is null or wall_ms >= 0),
  provider_duration_ms integer check (provider_duration_ms is null or provider_duration_ms >= 0),
  replay_count integer not null default 0 check (replay_count >= 0),
  replay_failed_count integer not null default 0
    check (replay_failed_count >= 0 and replay_failed_count <= replay_count),
  replay_provider_duration_ms bigint not null default 0
    check (replay_provider_duration_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_provider_calls_attempt_unique unique (job_id, attempt_id),
  constraint analysis_provider_calls_logical_attempt_unique
    unique (job_id, call_key, fallback_index, retry_index),
  constraint analysis_provider_calls_key_length
    check (char_length(call_key) between 1 and 240),
  constraint analysis_provider_calls_stage_format
    check (stage ~ '^[a-z0-9_:-]{1,80}$'),
  constraint analysis_provider_calls_operation_format
    check (operation ~ '^[a-z0-9_.:-]{1,120}$'),
  constraint analysis_provider_calls_provider_format
    check (provider ~ '^[a-z0-9_-]{1,40}$'),
  constraint analysis_provider_calls_model_length
    check (char_length(model) between 1 and 120),
  constraint analysis_provider_calls_catalog_length
    check (price_catalog_version is null or char_length(price_catalog_version) between 1 and 80),
  constraint analysis_provider_calls_error_length
    check (error_code is null or char_length(error_code) between 1 and 120),
  constraint analysis_provider_calls_terminal_shape check (
    (status = 'started' and ended_at is null)
    or (status in ('succeeded', 'failed') and ended_at is not null)
  ),
  constraint analysis_provider_calls_failure_shape check (
    (status = 'failed' and retryable is not null and fallback_allowed is not null)
    or (status <> 'failed' and retryable is null and fallback_allowed is null)
  ),
  constraint analysis_provider_calls_lease_shape check (
    (
      status = 'started'
      and lease_owner is not null
      and lease_expires_at is not null
      and finalized_by is null
    )
    or (
      status in ('succeeded', 'failed')
      and lease_owner is null
      and lease_expires_at is null
      and finalized_by is not null
    )
  ),
  constraint analysis_provider_calls_replay_lease_shape check (
    (replay_lease_owner is null) = (replay_lease_expires_at is null)
    and (replay_lease_owner is null or status = 'succeeded')
  )
);

create index analysis_provider_calls_job_started_idx
  on public.analysis_provider_calls (job_id, started_at, id);

create index analysis_provider_calls_incomplete_idx
  on public.analysis_provider_calls (job_id, status)
  where status = 'started' or billing_status = 'unknown';

alter table public.analysis_provider_calls enable row level security;

-- This ledger is internal observability data. It is deliberately unavailable
-- through the browser-facing Data API, even to the row owner.
revoke all on table public.analysis_provider_calls from public, anon, authenticated;
revoke all on sequence public.analysis_provider_calls_id_seq from public, anon, authenticated;
grant select, insert, update on table public.analysis_provider_calls to service_role;
grant usage, select on sequence public.analysis_provider_calls_id_seq to service_role;

-- Claims one active worker per logical provider attempt. The transaction only
-- locks the ledger row for the claim itself; the network call runs outside SQL.
-- An expired takeover is counted as a replay because the previous worker may
-- have reached the provider before crashing. This deliberately makes the cost
-- rollup indeterminate instead of silently under-reporting a possible charge.
create or replace function public.claim_analysis_provider_attempt(
  p_attempt_id uuid,
  p_job_id uuid,
  p_call_key text,
  p_stage text,
  p_operation text,
  p_provider text,
  p_model text,
  p_billing_status text,
  p_usage_kind text,
  p_fallback_index smallint,
  p_retry_index smallint,
  p_started_at timestamptz,
  p_lease_owner uuid,
  p_lease_seconds integer,
  p_claim_replay boolean
)
returns table(
  attempt_id uuid,
  started_at timestamptz,
  status text,
  retryable boolean,
  fallback_allowed boolean,
  error_code text,
  lease_acquired boolean,
  lease_expires_at timestamptz,
  reclaimed_expired_lease boolean,
  replay_lease_acquired boolean,
  replay_lease_expires_at timestamptz,
  reclaimed_expired_replay_lease boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.analysis_provider_calls%rowtype;
  v_inserted boolean := false;
  v_reclaimed boolean := false;
  v_replay_reclaimed boolean := false;
  v_replay_acquired boolean := false;
  v_lease_interval interval;
begin
  if p_lease_owner is null or p_started_at is null then
    raise exception 'provider_attempt_invalid_lease';
  end if;

  v_lease_interval := pg_catalog.make_interval(
    secs => greatest(30, least(1800, coalesce(p_lease_seconds, 150)))
  );

  insert into public.analysis_provider_calls (
    attempt_id,
    job_id,
    call_key,
    stage,
    operation,
    provider,
    model,
    status,
    billing_status,
    usage_kind,
    fallback_index,
    retry_index,
    started_at,
    lease_owner,
    lease_expires_at
  ) values (
    p_attempt_id,
    p_job_id,
    p_call_key,
    p_stage,
    p_operation,
    p_provider,
    p_model,
    'started',
    p_billing_status,
    p_usage_kind,
    p_fallback_index,
    p_retry_index,
    p_started_at,
    p_lease_owner,
    pg_catalog.now() + v_lease_interval
  )
  on conflict (job_id, call_key, fallback_index, retry_index) do nothing
  returning true into v_inserted;
  v_inserted := coalesce(v_inserted, false);

  select * into v_row
  from public.analysis_provider_calls as provider_call
  where provider_call.job_id = p_job_id
    and provider_call.call_key = p_call_key
    and provider_call.fallback_index = p_fallback_index
    and provider_call.retry_index = p_retry_index
  for update;

  if not found then
    raise exception 'provider_attempt_claim_missing';
  end if;

  if v_row.status = 'started'
    and not v_inserted
    and (
      v_row.lease_owner = p_lease_owner
      or v_row.lease_expires_at is null
      or v_row.lease_expires_at <= pg_catalog.now()
    ) then
    v_reclaimed := v_row.lease_owner is distinct from p_lease_owner;
    update public.analysis_provider_calls as provider_call
    set
      lease_owner = p_lease_owner,
      lease_expires_at = pg_catalog.now() + v_lease_interval,
      replay_count = provider_call.replay_count + case when v_reclaimed then 1 else 0 end,
      updated_at = pg_catalog.now()
    where provider_call.id = v_row.id
    returning * into v_row;
  end if;

  if v_row.status = 'succeeded'
    and coalesce(p_claim_replay, false)
    and (
      v_row.replay_lease_owner = p_lease_owner
      or v_row.replay_lease_owner is null
      or v_row.replay_lease_expires_at is null
      or v_row.replay_lease_expires_at <= pg_catalog.now()
    ) then
    v_replay_reclaimed := v_row.replay_lease_owner is not null
      and v_row.replay_lease_owner is distinct from p_lease_owner;
    update public.analysis_provider_calls as provider_call
    set
      replay_lease_owner = p_lease_owner,
      replay_lease_expires_at = pg_catalog.now() + v_lease_interval,
      replay_count = provider_call.replay_count
        + case when provider_call.replay_lease_owner is distinct from p_lease_owner then 1 else 0 end,
      updated_at = pg_catalog.now()
    where provider_call.id = v_row.id
    returning * into v_row;
    v_replay_acquired := true;
  end if;

  return query select
    v_row.attempt_id,
    v_row.started_at,
    v_row.status,
    v_row.retryable,
    v_row.fallback_allowed,
    v_row.error_code,
    (
      v_row.status = 'started'
      and v_row.lease_owner = p_lease_owner
      and v_row.lease_expires_at > pg_catalog.now()
    ),
    v_row.lease_expires_at,
    v_reclaimed,
    v_replay_acquired,
    v_row.replay_lease_expires_at,
    v_replay_reclaimed;
end;
$$;

create or replace function public.record_analysis_provider_replay(
  p_job_id uuid,
  p_attempt_id uuid,
  p_lease_owner uuid,
  p_succeeded boolean,
  p_provider_duration_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recorded boolean := false;
begin
  if p_provider_duration_ms < 0 then
    return false;
  end if;

  update public.analysis_provider_calls
  set
    replay_failed_count = replay_failed_count + case when p_succeeded then 0 else 1 end,
    replay_provider_duration_ms = replay_provider_duration_ms + p_provider_duration_ms,
    replay_lease_owner = null,
    replay_lease_expires_at = null,
    updated_at = now()
  where job_id = p_job_id
    and attempt_id = p_attempt_id
    and status = 'succeeded'
    and replay_lease_owner = p_lease_owner
  returning true into v_recorded;

  return coalesce(v_recorded, false);
end;
$$;

revoke all on function public.record_analysis_provider_replay(uuid, uuid, uuid, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.record_analysis_provider_replay(uuid, uuid, uuid, boolean, integer)
  to service_role;

revoke all on function public.claim_analysis_provider_attempt(
  uuid, uuid, text, text, text, text, text, text, text,
  smallint, smallint, timestamptz, uuid, integer, boolean
) from public, anon, authenticated;
grant execute on function public.claim_analysis_provider_attempt(
  uuid, uuid, text, text, text, text, text, text, text,
  smallint, smallint, timestamptz, uuid, integer, boolean
) to service_role;
