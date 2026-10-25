alter table profiles
  add column guide jsonb,
  add column guide_status text not null default 'none',
  add column guide_error text,
  add column guide_attempt integer not null default 0,
  add column capsule_owned jsonb not null default '[]';

create table tryons (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  outfit_id text not null,
  version integer not null,
  prompt text not null,
  path text,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  unique (profile_id, outfit_id, version)
);
