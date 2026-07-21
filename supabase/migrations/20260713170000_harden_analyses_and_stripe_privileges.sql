-- Production predates the explicit grants in the reproducible baseline and
-- still carries broad browser-role table privileges. RLS currently blocks
-- unsafe rows, but least privilege must also hold at the grant layer.

alter table public.analyses enable row level security;

-- Keep owner-scoped reads through the existing RLS policy, while preventing
-- browser clients from inserting, mutating, truncating or deleting analyses.
revoke all on table public.analyses from public, anon, authenticated;
grant select on table public.analyses to authenticated;
grant select, insert, update, delete on table public.analyses to service_role;

alter table public.stripe_webhook_events enable row level security;

-- Stripe event payloads and idempotency state are strictly server-side.
-- The service role keeps the CRUD access required by the webhook handler.
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;
