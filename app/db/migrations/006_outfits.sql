-- New outfits made from a finished profile. Each run adds ten to the profile's library; nothing
-- here replaces the ten looks on the sheet page or the guide.
create table outfit_runs (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  seasons text[] not null,
  styles text[] not null,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);
create unique index outfit_runs_one_pending on outfit_runs (profile_id) where status = 'pending';

create table outfits (
  id text primary key,
  run_id text not null references outfit_runs(id) on delete cascade,
  profile_id text not null references profiles(id) on delete cascade,
  idx integer not null,
  season text not null,
  style text not null,
  look jsonb not null,
  status text not null default 'pending',
  path text,
  error text,
  unique (run_id, idx)
);
create index outfits_profile on outfits (profile_id);
