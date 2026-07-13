alter table public.analyses
  add column if not exists reconstruction jsonb,
  add column if not exists reconstruction_created_at timestamptz,
  add column if not exists reconstruction_plan_used text;

alter table public.analyses
  drop constraint if exists analyses_reconstruction_plan_used_check;

alter table public.analyses
  add constraint analyses_reconstruction_plan_used_check
  check (reconstruction_plan_used is null or reconstruction_plan_used in ('pro', 'lifetime', 'scale'));

create index if not exists analyses_reconstruction_user_created_idx
  on public.analyses (user_id, reconstruction_created_at desc)
  where reconstruction is not null;
