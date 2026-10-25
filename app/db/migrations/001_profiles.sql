create table profiles (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  answers jsonb not null default '{}',
  photo_path text,
  photo_read jsonb,
  photo_read_status text not null default 'none',
  sheet_path text,
  sheet_status text not null default 'none',
  sheet_error text,
  sheet_approved boolean not null default false,
  attempt integer not null default 0
);
