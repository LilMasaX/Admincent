-- admincentic initial schema
create extension if not exists "pgcrypto";

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('pdf', 'docx')),
  storage_path text not null,
  fields jsonb not null default '[]'::jsonb,
  page_sizes jsonb,
  has_acroform boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists templates_owner_idx on templates(owner_id);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_users(id) on delete cascade,
  template_id uuid not null references templates(id) on delete cascade,
  storage_path text not null,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists certificates_owner_idx on certificates(owner_id);
create index if not exists certificates_template_idx on certificates(template_id);

-- Storage buckets (run once in Supabase dashboard or via CLI):
-- insert into storage.buckets (id, name, public) values ('templates', 'templates', false);
-- insert into storage.buckets (id, name, public) values ('certificates', 'certificates', false);

-- RLS off on app_users/templates/certificates because the server uses the service role key.
-- Do NOT expose the service role key to the browser.
