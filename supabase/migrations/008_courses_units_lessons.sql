-- Personalised courses, units, and generated lessons (per user, per target language)

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_code text not null,
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  generated_at timestamptz not null default now(),
  unique (user_id, language_code)
);

create index if not exists idx_courses_user_id on public.courses (user_id);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  topic_key text not null,
  title text not null,
  description text,
  personalisation_note text,
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  order_index int not null,
  status text not null check (status in ('locked', 'available', 'completed')),
  unlocked_at timestamptz,
  unique (course_id, order_index)
);

create index if not exists idx_units_course_id on public.units (course_id);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  type text not null check (type in ('vocabulary', 'grammar', 'reading', 'review')),
  title text not null,
  order_index int not null,
  status text not null check (status in ('locked', 'available', 'completed')),
  content jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  unique (unit_id, order_index)
);

create index if not exists idx_lessons_unit_id on public.lessons (unit_id);

alter table public.courses enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;

drop policy if exists "Users can access own courses" on public.courses;
create policy "Users can access own courses"
  on public.courses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can access own units" on public.units;
create policy "Users can access own units"
  on public.units for all
  using (
    exists (select 1 from public.courses c where c.id = units.course_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.courses c where c.id = units.course_id and c.user_id = auth.uid())
  );

drop policy if exists "Users can access own lessons" on public.lessons;
create policy "Users can access own lessons"
  on public.lessons for all
  using (
    exists (
      select 1 from public.units u
      join public.courses c on c.id = u.course_id
      where u.id = lessons.unit_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.units u
      join public.courses c on c.id = u.course_id
      where u.id = lessons.unit_id and c.user_id = auth.uid()
    )
  );
