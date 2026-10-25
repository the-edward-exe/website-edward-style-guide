alter table profiles
  add column looks jsonb,
  add column looks_status text not null default 'none',
  add column looks_error text,
  add column looks_attempt integer not null default 0;
