-- One picture per sheet-page look, made from the character sheet. A set belongs to one run of the
-- looks and one character sheet; a new run or a new sheet starts a fresh set.
create table look_images (
  profile_id text not null references profiles(id) on delete cascade,
  looks_attempt integer not null,
  sheet_attempt integer not null,
  idx integer not null,
  status text not null default 'pending',
  path text,
  error text,
  primary key (profile_id, looks_attempt, sheet_attempt, idx)
);
