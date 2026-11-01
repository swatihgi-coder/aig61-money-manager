-- MoneyManager database setup
-- Run once in Supabase: SQL Editor → New query → paste this file → Run.

-- One saved plan per user
create table if not exists public.plans (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,   -- all checkup answers
  step       int  not null default 0,               -- last checkup step viewed
  max_step   int  not null default 0,               -- furthest step reached
  score      int,                                   -- latest health score (0-100)
  updated_at timestamptz not null default now()
);

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

-- Row-level security: every user can only see and change their own rows.
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
