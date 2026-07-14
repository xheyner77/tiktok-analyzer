-- Durable, owner-scoped video analysis jobs and exactly-once quota handling.
-- This migration does not change commercial limits; it calls the canonical
-- quota_analysis_limit_for_plan helper already used by the synchronous route.

alter table public.analyses
  add column if not exists engine_result jsonb,
  add column if not exists analysis_schema_version text,
  add column if not exists analysis_prompt_version text,
  add column if not exists pipeline_version text,
  add column if not exists model_version text;

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'uploading'
    check (status in (
      'uploading',
      'queued',
      'preprocessing',
      'transcribing',
      'visual_analysis',
      'audio_analysis',
      'segment_analysis',
      'synthesis',
      'validation',
      'completed',
      'failed'
    )),
  progress smallint not null default 0 check (progress between 0 and 100),
  current_step text not null default 'uploading',
  storage_bucket text not null default 'analysis-inputs'
    check (storage_bucket = 'analysis-inputs'),
  storage_path text not null,
  original_file_name text not null
    check (char_length(original_file_name) between 1 and 160),
  content_type text not null
    check (content_type in (
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-matroska',
      'video/mpeg'
    )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 262144000),
  creator_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(creator_context) = 'object'),
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  probe jsonb,
  transcript jsonb,
  technical_signals jsonb,
  cost_metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(cost_metrics) = 'object'),
  workflow_run_id text check (
    workflow_run_id is null
    or char_length(workflow_run_id) between 1 and 255
  ),
  analysis_id uuid references public.analyses(id) on delete set null,
  quota_state text not null default 'not_reserved'
    check (quota_state in ('not_reserved', 'reserved', 'consumed', 'refunded')),
  quota_used integer check (quota_used is null or quota_used >= 0),
  quota_limit integer check (quota_limit is null or quota_limit >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  upload_completed_at timestamptz,
  quota_reserved_at timestamptz,
  quota_period_started_at timestamptz,
  cleanup_pending boolean not null default true,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint analysis_jobs_idempotency_key_length
    check (char_length(idempotency_key) between 16 and 160),
  constraint analysis_jobs_idempotency_key_format
    check (idempotency_key ~ '^[A-Za-z0-9:_-]+$'),
  constraint analysis_jobs_storage_path_owner
    check (storage_path ~ ('^' || user_id::text || '/' || id::text || '/input\.[a-z0-9]{2,5}$')),
  unique (user_id, idempotency_key),
  unique (id, user_id)
);

create index if not exists analysis_jobs_user_created_idx
  on public.analysis_jobs (user_id, created_at desc);

create index if not exists analysis_jobs_analysis_id_idx
  on public.analysis_jobs (analysis_id)
  where analysis_id is not null;

create index if not exists analysis_jobs_active_idx
  on public.analysis_jobs (status, updated_at)
  where status not in ('completed', 'failed');

create index if not exists analysis_jobs_terminal_cleanup_idx
  on public.analysis_jobs (updated_at)
  where cleanup_pending = true
    and status in ('completed', 'failed');

create table if not exists public.analysis_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.analysis_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('frame', 'ocr', 'audio', 'report')),
  storage_bucket text,
  storage_path text,
  start_time numeric(10, 3) not null check (start_time >= 0),
  end_time numeric(10, 3) not null check (end_time >= start_time),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint analysis_artifacts_job_owner_fk
    foreign key (job_id, user_id)
    references public.analysis_jobs (id, user_id)
    on delete cascade,
  constraint analysis_artifacts_storage_pair
    check ((storage_bucket is null) = (storage_path is null)),
  constraint analysis_artifacts_storage_bucket
    check (storage_bucket is null or storage_bucket = 'analysis-evidence'),
  constraint analysis_artifacts_storage_path_owner
    check (
      storage_path is null
      or (
        storage_path like user_id::text || '/' || job_id::text || '/%'
        and storage_path !~ '(^|/)\.{1,2}(/|$)'
        and storage_path !~ '[\\]'
      )
    )
);

create index if not exists analysis_artifacts_job_time_idx
  on public.analysis_artifacts (job_id, start_time);

create index if not exists analysis_artifacts_user_id_idx
  on public.analysis_artifacts (user_id);

alter table public.analysis_jobs enable row level security;
alter table public.analysis_artifacts enable row level security;

revoke all on table public.analysis_jobs from public, anon, authenticated;
revoke all on table public.analysis_artifacts from public, anon, authenticated;
grant select, insert, update, delete on table public.analysis_jobs to service_role;
grant select, insert, update, delete on table public.analysis_artifacts to service_role;

-- The browser receives a short-lived signed upload token from an authenticated
-- server route. No direct Data API or Storage policy is required for writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'analysis-inputs',
  'analysis-inputs',
  false,
  262144000,
  array[
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska',
    'video/mpeg'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'analysis-evidence',
  'analysis-evidence',
  false,
  26214400,
  array['image/jpeg', 'application/json', 'audio/mpeg', 'audio/wav']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.touch_analysis_job_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists analysis_jobs_updated_at on public.analysis_jobs;
create trigger analysis_jobs_updated_at
  before update on public.analysis_jobs
  for each row execute function public.touch_analysis_job_updated_at();

create or replace function public.enforce_analysis_job_active_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_active_count integer;
begin
  -- Sérialise les créations d'un même utilisateur : un simple COUNT dans
  -- la route serait contournable par plusieurs requêtes concurrentes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select count(*) into v_active_count
  from public.analysis_jobs
  where user_id = new.user_id
    and status not in ('completed', 'failed');

  if v_active_count >= 3 then
    raise exception 'analysis_job_active_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists analysis_jobs_active_limit on public.analysis_jobs;
create trigger analysis_jobs_active_limit
  before insert on public.analysis_jobs
  for each row execute function public.enforce_analysis_job_active_limit();

create or replace function public.reserve_analysis_job_quota(
  p_job_id uuid,
  p_user_id uuid
)
returns table(allowed boolean, used integer, limit_value integer, quota_state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.analysis_jobs%rowtype;
  v_plan text;
  v_subscription_status text;
  v_stripe_subscription_id text;
  v_current integer;
  v_limit integer;
  v_quota_period_started_at timestamptz;
begin
  select * into v_job
  from public.analysis_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  if not found then
    return query select false, 0, 0, 'not_found'::text;
    return;
  end if;

  select u.plan, u.subscription_status, u.stripe_subscription_id, u.analyses_count, u.last_reset_at
  into v_plan, v_subscription_status, v_stripe_subscription_id, v_current, v_quota_period_started_at
  from public.users as u
  where u.id = p_user_id
  for update;

  if not found then
    return query select false, 0, 0, 'user_not_found'::text;
    return;
  end if;

  v_limit := public.quota_analysis_limit_for_plan(
    v_plan,
    v_subscription_status,
    v_stripe_subscription_id
  );

  if v_job.quota_state in ('reserved', 'consumed') then
    return query select true, v_current, v_limit, v_job.quota_state;
    return;
  end if;

  if v_job.quota_state = 'refunded' or v_job.status in ('completed', 'failed') then
    return query select false, v_current, v_limit, v_job.quota_state;
    return;
  end if;

  if v_job.status <> 'uploading' then
    return query select false, v_current, v_limit, 'invalid_state'::text;
    return;
  end if;

  if v_current + 1 > v_limit then
    update public.analysis_jobs
    set quota_used = v_current, quota_limit = v_limit
    where id = p_job_id and user_id = p_user_id;
    return query select false, v_current, v_limit, 'not_reserved'::text;
    return;
  end if;

  update public.users
  set analyses_count = analyses_count + 1
  where id = p_user_id
  returning analyses_count into v_current;

  update public.analysis_jobs
  set
    quota_state = 'reserved',
    quota_used = v_current,
    quota_limit = v_limit,
    quota_reserved_at = now(),
    quota_period_started_at = v_quota_period_started_at,
    upload_completed_at = coalesce(upload_completed_at, now()),
    status = 'queued',
    current_step = 'queued',
    progress = greatest(progress, 5)
  where id = p_job_id;

  return query select true, v_current, v_limit, 'reserved'::text;
end;
$$;

create or replace function public.claim_analysis_job_workflow_start(
  p_job_id uuid,
  p_user_id uuid,
  p_claim text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
begin
  if p_claim !~ '^starting:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  update public.analysis_jobs
  set workflow_run_id = p_claim
  where id = p_job_id
    and user_id = p_user_id
    and status = 'queued'
    and quota_state = 'reserved'
    and (
      workflow_run_id is null
      or (
        workflow_run_id like 'starting:%'
        and updated_at < now() - interval '2 minutes'
      )
    )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

create or replace function public.complete_analysis_job(
  p_job_id uuid,
  p_user_id uuid,
  p_video_url text,
  p_legacy_result jsonb,
  p_engine_result jsonb,
  p_schema_version text,
  p_prompt_version text,
  p_pipeline_version text,
  p_model_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.analysis_jobs%rowtype;
  v_analysis_id uuid;
begin
  select * into v_job
  from public.analysis_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'analysis_job_not_found';
  end if;

  if v_job.status = 'completed' and v_job.analysis_id is not null then
    return v_job.analysis_id;
  end if;

  if v_job.quota_state <> 'reserved' then
    raise exception 'analysis_job_quota_not_reserved';
  end if;

  if v_job.status not in ('synthesis', 'validation') then
    raise exception 'analysis_job_invalid_completion_state';
  end if;

  if jsonb_typeof(p_legacy_result) is distinct from 'object'
    or jsonb_typeof(p_engine_result) is distinct from 'object' then
    raise exception 'analysis_job_invalid_result_payload';
  end if;

  if p_engine_result ->> 'analysisId' is distinct from p_job_id::text then
    raise exception 'analysis_job_result_identity_mismatch';
  end if;

  if nullif(trim(p_schema_version), '') is null
    or nullif(trim(p_prompt_version), '') is null
    or nullif(trim(p_pipeline_version), '') is null
    or nullif(trim(p_model_version), '') is null then
    raise exception 'analysis_job_missing_version';
  end if;

  insert into public.analyses (
    id,
    user_id,
    video_url,
    result,
    engine_result,
    analysis_schema_version,
    analysis_prompt_version,
    pipeline_version,
    model_version
  ) values (
    p_job_id,
    p_user_id,
    p_video_url,
    p_legacy_result,
    p_engine_result,
    p_schema_version,
    p_prompt_version,
    p_pipeline_version,
    p_model_version
  )
  returning id into v_analysis_id;

  update public.analysis_jobs
  set
    analysis_id = v_analysis_id,
    status = 'completed',
    current_step = 'completed',
    progress = 100,
    quota_state = 'consumed',
    cleanup_pending = true,
    completed_at = now(),
    error_code = null,
    error_message = null
  where id = p_job_id;

  return v_analysis_id;
end;
$$;

create or replace function public.fail_analysis_job(
  p_job_id uuid,
  p_user_id uuid,
  p_error_code text,
  p_error_message text
)
returns table(refunded boolean, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.analysis_jobs%rowtype;
  v_used integer;
  v_current_quota_period_started_at timestamptz;
  v_refunded boolean := false;
begin
  select * into v_job
  from public.analysis_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  if not found then
    return query select false, 0;
    return;
  end if;

  select analyses_count, last_reset_at
  into v_used, v_current_quota_period_started_at
  from public.users
  where id = p_user_id
  for update;

  if v_job.status <> 'completed' and v_job.quota_state = 'reserved' then
    -- A reset/invoice may have opened a new quota period while the workflow
    -- was running. The old reservation is already erased by that reset and
    -- must never decrement the new period.
    if v_job.quota_period_started_at is not distinct from v_current_quota_period_started_at then
      update public.users
      set analyses_count = greatest(analyses_count - 1, 0)
      where id = p_user_id
      returning analyses_count into v_used;
    end if;
    v_refunded := true;
  end if;

  if v_job.status <> 'completed' then
    update public.analysis_jobs
    set
      status = 'failed',
      current_step = 'failed',
      quota_state = case when v_refunded then 'refunded' else quota_state end,
      cleanup_pending = true,
      quota_used = coalesce(v_used, quota_used),
      error_code = left(coalesce(p_error_code, 'ANALYSIS_FAILED'), 120),
      error_message = left(coalesce(p_error_message, 'Analyse interrompue.'), 500),
      failed_at = coalesce(failed_at, now())
    where id = p_job_id;
  end if;

  return query select v_refunded, coalesce(v_used, 0);
end;
$$;

-- Compare-and-swap used by the stale-job reconciler. The row is locked and
-- its status/timestamp are rechecked atomically so a job that resumed after
-- the cron SELECT can never be failed, refunded or cleaned by that cron run.
create or replace function public.fail_stale_analysis_job(
  p_job_id uuid,
  p_user_id uuid,
  p_expected_statuses text[],
  p_stale_before timestamptz,
  p_error_code text,
  p_error_message text
)
returns table(transitioned boolean, refunded boolean, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.analysis_jobs%rowtype;
  v_used integer := 0;
  v_current_quota_period_started_at timestamptz;
  v_refunded boolean := false;
  v_stale_timestamp timestamptz;
begin
  if p_stale_before is null or coalesce(cardinality(p_expected_statuses), 0) = 0 then
    return query select false, false, 0;
    return;
  end if;

  select * into v_job
  from public.analysis_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  if not found or not (v_job.status = any(p_expected_statuses)) then
    return query select false, false, 0;
    return;
  end if;

  v_stale_timestamp := case
    when v_job.status = 'uploading' then v_job.created_at
    else v_job.updated_at
  end;
  if v_stale_timestamp >= p_stale_before then
    return query select false, false, 0;
    return;
  end if;

  select analyses_count, last_reset_at
  into v_used, v_current_quota_period_started_at
  from public.users
  where id = p_user_id
  for update;

  if v_job.quota_state = 'reserved' then
    if v_job.quota_period_started_at is not distinct from v_current_quota_period_started_at then
      update public.users
      set analyses_count = greatest(analyses_count - 1, 0)
      where id = p_user_id
      returning analyses_count into v_used;
    end if;
    v_refunded := true;
  end if;

  update public.analysis_jobs
  set
    status = 'failed',
    current_step = 'failed',
    quota_state = case when v_refunded then 'refunded' else quota_state end,
    cleanup_pending = true,
    quota_used = coalesce(v_used, quota_used),
    error_code = left(coalesce(p_error_code, 'ANALYSIS_PROCESSING_EXPIRED'), 120),
    error_message = left(coalesce(p_error_message, 'Analyse expirée.'), 500),
    failed_at = coalesce(failed_at, now())
  where id = p_job_id and user_id = p_user_id;

  return query select true, v_refunded, coalesce(v_used, 0);
end;
$$;

revoke all on function public.touch_analysis_job_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_analysis_job_active_limit() from public, anon, authenticated;
revoke all on function public.reserve_analysis_job_quota(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_analysis_job_workflow_start(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_analysis_job(uuid, uuid, text, jsonb, jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_analysis_job(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.fail_stale_analysis_job(uuid, uuid, text[], timestamptz, text, text) from public, anon, authenticated;

grant execute on function public.reserve_analysis_job_quota(uuid, uuid) to service_role;
grant execute on function public.claim_analysis_job_workflow_start(uuid, uuid, text) to service_role;
grant execute on function public.complete_analysis_job(uuid, uuid, text, jsonb, jsonb, text, text, text, text) to service_role;
grant execute on function public.fail_analysis_job(uuid, uuid, text, text) to service_role;
grant execute on function public.fail_stale_analysis_job(uuid, uuid, text[], timestamptz, text, text) to service_role;
