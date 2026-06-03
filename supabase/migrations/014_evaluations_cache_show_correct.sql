-- evaluations_cache was created before show_correct was added to 012.
-- CREATE TABLE IF NOT EXISTS skips silently, so the column never landed.

alter table public.evaluations_cache
  add column if not exists show_correct boolean not null default false;
