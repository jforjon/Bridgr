-- Placement test results (one row per user per target language, upsert on submit)

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_code text not null,
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  score int not null,
  total_questions int not null,
  weak_areas text[] not null default '{}',
  skipped boolean not null default false,
  completed_at timestamptz not null default now(),
  unique (user_id, language_code)
);

create index if not exists idx_placements_user_id on public.placements (user_id);

alter table public.placements enable row level security;

create policy "Users can access own placements"
  on public.placements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
