-- Split user_languages into known_languages + learning_languages (idempotent for fresh DBs).

create table if not exists public.known_languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  language_code text not null,
  language_name text not null,
  proficiency text not null check (proficiency in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at timestamptz not null default now(),
  unique (user_id, language_code)
);

create table if not exists public.learning_languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  language_code text not null,
  language_name text not null,
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  placement_completed boolean not null default false,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, language_code)
);

create index if not exists idx_known_languages_user_id on public.known_languages(user_id);
create index if not exists idx_learning_languages_user_id on public.learning_languages(user_id);

alter table public.known_languages enable row level security;
alter table public.learning_languages enable row level security;

drop policy if exists "Users can access own known_languages" on public.known_languages;
create policy "Users can access own known_languages"
  on public.known_languages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can access own learning_languages" on public.learning_languages;
create policy "Users can access own learning_languages"
  on public.learning_languages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One-time copy from legacy user_languages (when that table still exists)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_languages'
  ) then
    insert into public.known_languages (user_id, language_code, language_name, proficiency)
    select user_id, language_code, language_name, proficiency
    from public.user_languages
    where is_target = false
    on conflict (user_id, language_code) do nothing;

    insert into public.learning_languages (user_id, language_code, language_name, cefr_level, placement_completed)
    select user_id, language_code, language_name, proficiency, false
    from public.user_languages
    where is_target = true
    on conflict (user_id, language_code) do nothing;

    drop policy if exists "Users can access own user_languages" on public.user_languages;
    drop table if exists public.user_languages;
  end if;
end $$;
