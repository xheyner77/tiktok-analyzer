-- Reconstruction IA quotas and persisted reconstruction snapshots.

alter table public.users
  add column if not exists reconstructions_count integer not null default 0;

alter table public.analyses
  add column if not exists reconstruction jsonb,
  add column if not exists reconstruction_created_at timestamptz,
  add column if not exists reconstruction_plan_used text check (reconstruction_plan_used in ('pro', 'scale'));

create index if not exists analyses_reconstruction_user_created_idx
  on public.analyses (user_id, reconstruction_created_at desc)
  where reconstruction is not null;

create or replace function public.increment_reconstructions_count_by(p_user_id uuid, p_amount int)
returns void
language sql
security definer
as $$
  update public.users
  set reconstructions_count = reconstructions_count + greatest(1, p_amount)
  where id = p_user_id;
$$;
