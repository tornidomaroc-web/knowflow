-- iOS 1.1, item 4d (server half): Pro bought inside the iPhone app through
-- the App Store (StoreKit 2), beside Pro bought on the web through Paddle.
--
-- A TABLE OF ITS OWN, NOT COLUMNS ON public.subscriptions. One student's Pro
-- may come from Paddle OR Apple, and neither source may overwrite the other:
--   * public.subscriptions is untouched, so the Paddle webhook (#325), the
--     cancel route, account deletion and the billing note read and write
--     exactly what they did, and their proofs run unchanged;
--   * an Apple row can never be matched by the webhook's
--     paddle_subscription_id key, nor a Paddle row by this table's
--     original_transaction_id key: the two writers share no row at all;
--   * src/lib/subscription/unaccounted.ts would treat an entitling
--     subscriptions row WITHOUT a Paddle id as "billing we cannot reach" and
--     block account deletion. An Apple subscription IS one we cannot cancel
--     (only the student can, in the App Store), and Apple 5.1.1(v) requires
--     deletion to proceed; a separate table keeps that guard exactly as it
--     is for Paddle.
-- Entitlement (src/lib/entitlement.ts) reads both tables: Pro if either has
-- a live row.
--
-- ONE ROW PER APPLE SUBSCRIPTION (original_transaction_id, UNIQUE). Renewals
-- are new transactions of the same original transaction and update the row.
-- Ordering: last_signed_at holds Apple's signedDate of the last notification
-- or transaction applied, and a write lands only on a row whose
-- last_signed_at is OLDER (the #325 occurred_at guard, Apple's clock).
--
-- WHO MAY DO WHAT:
--   anon           nothing.
--   authenticated  SELECT of its own rows only (RLS), for the entitlement
--                  read. No write grant and no write policy.
--   service_role   SELECT, INSERT, UPDATE: the two routes (POST
--                  /api/apple/iap/verify, POST /api/apple/notifications).
--                  No DELETE: a row is never removed by the server; account
--                  deletion removes it by the foreign key's ON DELETE CASCADE.
--
-- Idempotent: safe to run more than once. Run on production BEFORE the
-- merge (the entitlement read logs an error and ignores Apple rows while the
-- table is missing; Paddle Pro is unaffected either way).

create table if not exists public.apple_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_transaction_id text not null,
  product_id text not null,
  environment text not null,
  status text not null,
  expires_at timestamptz,
  last_transaction_id text not null,
  last_signed_at timestamptz not null,
  last_notification_uuid uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apple_subscriptions drop constraint if exists apple_subscriptions_original_transaction_id_key;
alter table public.apple_subscriptions add constraint apple_subscriptions_original_transaction_id_key
  unique (original_transaction_id);

alter table public.apple_subscriptions drop constraint if exists apple_subscriptions_environment_check;
alter table public.apple_subscriptions add constraint apple_subscriptions_environment_check
  check (environment in ('Production', 'Sandbox'));

alter table public.apple_subscriptions drop constraint if exists apple_subscriptions_status_check;
alter table public.apple_subscriptions add constraint apple_subscriptions_status_check
  check (status in ('active', 'grace_period', 'billing_retry', 'expired', 'revoked', 'refunded'));

-- An entitling row without a known end would grant unbounded Pro: refused by
-- the table itself, for every writer (the #325 rule, in the schema this time).
alter table public.apple_subscriptions drop constraint if exists apple_subscriptions_entitled_has_end;
alter table public.apple_subscriptions add constraint apple_subscriptions_entitled_has_end
  check (status not in ('active', 'grace_period') or expires_at is not null);

create index if not exists apple_subscriptions_user_id on public.apple_subscriptions (user_id);

alter table public.apple_subscriptions enable row level security;

drop policy if exists "Users can view own apple subscription" on public.apple_subscriptions;
create policy "Users can view own apple subscription" on public.apple_subscriptions
  for select using (auth.uid() = user_id);

-- Supabase's default privileges grant every table to anon, authenticated and
-- service_role; take them all back, then give exactly the above.
revoke all on table public.apple_subscriptions from public, anon, authenticated, service_role;
grant select on table public.apple_subscriptions to authenticated;
grant select, insert, update on table public.apple_subscriptions to service_role;

-- VERIFY (read-only; run after the statements above):
-- select 'table' as what, relname || ' rls=' || relrowsecurity as value from pg_class where oid = 'public.apple_subscriptions'::regclass
-- union all
-- select 'grant', r || ': ' || string_agg(p || '=' || has_table_privilege(r, 'public.apple_subscriptions', p)::text, ' ' order by o)
--   from (values ('anon'), ('authenticated'), ('service_role')) as rr(r),
--        (values ('SELECT', 1), ('INSERT', 2), ('UPDATE', 3), ('DELETE', 4)) as pp(p, o)
--  group by r
-- union all
-- select 'policy', policyname || ' cmd=' || cmd from pg_policies where schemaname = 'public' and tablename = 'apple_subscriptions'
-- union all
-- select 'constraint', conname || '=' || pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.apple_subscriptions'::regclass and contype in ('c', 'u', 'f')
-- union all
-- select 'rows', count(*)::text from public.apple_subscriptions
-- union all
-- select 'subscriptions-untouched', string_agg(column_name || ':' || data_type, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions'
-- order by 1, 2;
--
-- Expected rows (12):
--   constraint              | apple_subscriptions_entitled_has_end=CHECK (((status <> ALL (ARRAY['active'::text, 'grace_period'::text])) OR (expires_at IS NOT NULL)))
--   constraint              | apple_subscriptions_environment_check=CHECK ((environment = ANY (ARRAY['Production'::text, 'Sandbox'::text])))
--   constraint              | apple_subscriptions_original_transaction_id_key=UNIQUE (original_transaction_id)
--   constraint              | apple_subscriptions_status_check=CHECK ((status = ANY (ARRAY['active'::text, 'grace_period'::text, 'billing_retry'::text, 'expired'::text, 'revoked'::text, 'refunded'::text])))
--   constraint              | apple_subscriptions_user_id_fkey=FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
--   grant                   | anon: SELECT=false INSERT=false UPDATE=false DELETE=false
--   grant                   | authenticated: SELECT=true INSERT=false UPDATE=false DELETE=false
--   grant                   | service_role: SELECT=true INSERT=true UPDATE=true DELETE=false
--   policy                  | Users can view own apple subscription cmd=SELECT
--   rows                    | 0
--   subscriptions-untouched | id:uuid,user_id:uuid,paddle_subscription_id:text,paddle_customer_id:text,status:text,current_period_end:timestamp with time zone,created_at:timestamp with time zone,updated_at:timestamp with time zone
--   table                   | apple_subscriptions rls=true
-- (scripts/verify-apple-subscriptions-db.mjs runs this query on the fixture
-- and asserts exactly these twelve lines.)
--
-- ROLLBACK (only while no row exists; a row is a paid subscription):
--   drop table if exists public.apple_subscriptions;
