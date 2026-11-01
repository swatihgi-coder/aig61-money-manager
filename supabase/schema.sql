-- MoneyManager database setup (Supabase / Postgres)
-- Safe to run more than once.

-- One saved plan per user. The readable columns make the Table Editor easy to scan;
-- the full checkup answers live in "state".
create table if not exists public.plans (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name             text,
  updated_at       timestamptz not null default now(),
  score            int,                -- health score 0-100
  household_income numeric,
  monthly_surplus  numeric,
  net_worth        numeric,
  protection_gap   numeric,
  retirement_gap   numeric,
  checkup_step     text,
  step             int  not null default 0,
  max_step         int  not null default 0,
  state            jsonb not null default '{}'::jsonb
);
alter table public.plans add column if not exists name text;
alter table public.plans add column if not exists household_income numeric;
alter table public.plans add column if not exists monthly_surplus numeric;
alter table public.plans add column if not exists net_worth numeric;
alter table public.plans add column if not exists protection_gap numeric;
alter table public.plans add column if not exists retirement_gap numeric;
alter table public.plans add column if not exists checkup_step text;

-- Score history ("Save to history")
create table if not exists public.checkups (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at              timestamptz not null default now(),
  score           int not null,
  grade           text,
  protection_gap  numeric,
  retirement_gap  numeric
);
create index if not exists checkups_user_at on public.checkups (user_id, at desc);

-- Row-level security: each signed-in user can only see and change their own rows.
alter table public.plans    enable row level security;
alter table public.checkups enable row level security;

drop policy if exists "plans: read own"   on public.plans;
drop policy if exists "plans: insert own" on public.plans;
drop policy if exists "plans: update own" on public.plans;
drop policy if exists "plans: delete own" on public.plans;
create policy "plans: read own"   on public.plans for select to authenticated using ((select auth.uid()) = user_id);
create policy "plans: insert own" on public.plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plans: update own" on public.plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "plans: delete own" on public.plans for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "checkups: read own"   on public.checkups;
drop policy if exists "checkups: insert own" on public.checkups;
drop policy if exists "checkups: delete own" on public.checkups;
create policy "checkups: read own"   on public.checkups for select to authenticated using ((select auth.uid()) = user_id);
create policy "checkups: insert own" on public.checkups for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "checkups: delete own" on public.checkups for delete to authenticated using ((select auth.uid()) = user_id);
