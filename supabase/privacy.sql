-- MoneyManager: Privacy Notice versions + consent evidence (applied to project "moneymanager").
-- Kept here as documentation of what's in the database.

-- Published notice versions: exact text + SHA-256 fingerprint. Text can't be edited or deleted.
create table if not exists public.privacy_notices (
  version text primary key, title text not null, effective_date date not null,
  content text not null, content_sha256 text not null,
  is_current boolean not null default false, published_at timestamptz not null default now()
);
create unique index if not exists privacy_notices_one_current on public.privacy_notices (is_current) where is_current;
-- triggers (schema "private"): privacy_notices_fingerprint (sets content_sha256 on insert),
--                               privacy_notices_lock (blocks edits/deletes)
-- RLS: anyone can read notices.

-- Consent log: one row per Accept / Decline. Users can add and read their own rows; nobody can edit/delete via the app.
create table if not exists public.privacy_consents (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text, notice_version text not null references public.privacy_notices(version),
  notice_sha256 text not null, decision text not null check (decision in ('accepted','declined')),
  checkbox_text text, scrolled_to_end boolean,
  source text check (source in ('registration','sign-in','notice-update')),
  user_agent text, timezone text, ip_address text,
  created_at timestamptz not null default now()
);
-- trigger private.privacy_consents_stamp: server sets user_id, email, notice_sha256, ip_address and created_at.
-- private.has_accepted_current_privacy_notice(): plans and checkups RLS require an accepted current notice.

-- Evidence report (owner): select * from public.privacy_consent_log;
-- Columns: recorded_at, email, decision, notice_version, notice_date, source, checkbox_text,
--          scrolled_to_end, ip_address, user_agent, timezone, notice_sha256, text_matches_published.

-- Publishing a NEW version later (example):
--   update public.privacy_notices set is_current = false where is_current;
--   insert into public.privacy_notices (version, title, effective_date, content, content_sha256, is_current)
--   values ('2027-01-15', 'MoneyManager Privacy Notice', '2027-01-15', '<full text>', '', true);
-- Everyone is asked to accept the new version at their next sign-in.
