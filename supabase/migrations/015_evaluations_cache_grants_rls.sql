-- Migration 012 used CREATE TABLE IF NOT EXISTS, so its GRANT statements were
-- silently skipped on databases where the table already existed. Fix that here.
-- The table is an app-wide shared cache, so RLS is intentionally disabled.

grant select, insert on public.evaluations_cache to authenticated;
grant select, insert, update on public.evaluations_cache to service_role;

alter table public.evaluations_cache disable row level security;
