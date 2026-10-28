-- Run in Supabase SQL editor
create extension if not exists "pgcrypto";

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  password_hash text not null,
  role text not null default 'user',   -- 'user' or 'admin'
  created_at timestamptz default now()
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique not null,
  title text not null,
  court text,
  created_at timestamptz default now()
);

-- who is enrolled in which case (managed by court staff / admin)
create table case_enrollments (
  user_id uuid references users(id) on delete cascade,
  case_id uuid references cases(id) on delete cascade,
  primary key (user_id, case_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  title text not null,
  language text default 'en',      -- original language of the document
  content text not null,           -- extracted text of the document
  created_at timestamptz default now()
);

-- cache so the same doc+language isn't re-summarized every time
create table summaries (
  document_id uuid references documents(id) on delete cascade,
  language text not null,
  summary text not null,
  created_at timestamptz default now(),
  primary key (document_id, language)
);

-- Backend uses the service-role key; lock the tables from the public anon key
alter table users enable row level security;
alter table cases enable row level security;
alter table case_enrollments enable row level security;
alter table documents enable row level security;
alter table summaries enable row level security;

-- ALREADY ran the old schema? Run this instead:
--   alter table users add column role text not null default 'user';
-- Make yourself the first admin (after registering in the app):
--   update users set role = 'admin' where email = 'you@example.com';
