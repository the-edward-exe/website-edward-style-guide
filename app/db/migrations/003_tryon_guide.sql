-- Each try-on belongs to the guide it was made for; a rewritten guide starts a fresh dressing room.
alter table tryons add column guide_attempt integer not null default 0;
update tryons t set guide_attempt = p.guide_attempt from profiles p where p.id = t.profile_id;
