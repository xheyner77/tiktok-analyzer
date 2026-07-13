-- Security fix for Supabase Advisor `function_search_path_mutable`.
--
-- Keep the exact trigger behavior used by users_updated_at and future
-- updated_at triggers: set NEW.updated_at to the current timestamp.
-- The function does not need objects from a mutable schema, so use an empty
-- search_path and rely only on pg_catalog resolution for now().

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
