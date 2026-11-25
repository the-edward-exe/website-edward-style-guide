-- Pressing X on an outfit or look: the row keeps its place while a new one is written for it.
-- The old text stays until then, so the stylist can be told what was rejected.
alter table outfits add column replacing boolean not null default false;
alter table look_images add column replacing boolean not null default false;
