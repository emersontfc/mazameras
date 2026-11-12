-- Preserve the Sites application schema and millisecond timestamps.
-- This migration preserves custom application accounts; it does not create
-- Supabase Auth users. Execute as the database owner in a new project.
begin;

create table public.accounts (
  id text primary key,
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  salt text not null,
  role text not null default 'author',
  created_at bigint not null
);

create table public.entries (
  id text primary key,
  user_id text not null,
  author text not null,
  email text,
  chapter text not null,
  question text not null,
  answer text not null,
  visibility text not null default 'book',
  created_at bigint not null,
  updated_at bigint not null
);
create unique index entry_user_question on public.entries (user_id, question);

create table public.editorial_pages (
  key text primary key,
  title text not null,
  category text not null,
  body text not null default '',
  status text not null default 'draft',
  updated_at bigint not null
);

create table public.sessions (
  token_hash text primary key,
  account_id text not null,
  expires_at bigint not null
);

create table public.login_attempts (
  username text primary key,
  count integer not null,
  last_attempt bigint not null
);

-- Custom authentication is enforced by the application's server.
-- Browser clients must never read password hashes, sessions or private answers.
alter table public.accounts enable row level security;
alter table public.entries enable row level security;
alter table public.editorial_pages enable row level security;
alter table public.sessions enable row level security;
alter table public.login_attempts enable row level security;
revoke all on table public.accounts, public.entries, public.editorial_pages,
  public.sessions, public.login_attempts from anon, authenticated;
grant select, insert, update, delete on table public.accounts, public.entries,
  public.editorial_pages, public.sessions, public.login_attempts to service_role;

commit;
