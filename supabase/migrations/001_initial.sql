create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  subscription_status text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  language_code text not null,
  language_name text not null,
  proficiency text not null check (proficiency in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  is_target boolean not null default false
);

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  language_code text not null,
  translation text not null,
  romanization text,
  part_of_speech text,
  audio_url text
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  ease_factor float not null default 2.5,
  interval_days int not null default 1,
  repetitions int not null default 0,
  next_review_date date not null default now(),
  last_quality int,
  unique (user_id, word_id)
);

create table if not exists public.hints (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words(id) on delete cascade,
  source_language_code text not null,
  hint_text text not null,
  hint_type text not null check (hint_type in ('cognate', 'shared_root', 'grammar_analogy', 'false_friend', 'structural_parallel')),
  confidence float not null
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_date date not null default now(),
  words_seen int not null default 0,
  words_mastered int not null default 0,
  streak_days int not null default 0,
  xp_earned int not null default 0
);

create index if not exists idx_flashcards_user_next_review on public.flashcards(user_id, next_review_date);
create index if not exists idx_user_languages_user_id on public.user_languages(user_id);
create index if not exists idx_words_language_code on public.words(language_code);
create index if not exists idx_hints_word_id on public.hints(word_id);

alter table public.profiles enable row level security;
alter table public.user_languages enable row level security;
alter table public.words enable row level security;
alter table public.flashcards enable row level security;
alter table public.hints enable row level security;
alter table public.lesson_progress enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can access own user_languages"
  on public.user_languages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authenticated users can read words"
  on public.words for select
  using (auth.uid() is not null);

create policy "Users can access own flashcards"
  on public.flashcards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authenticated users can read hints"
  on public.hints for select
  using (auth.uid() is not null);

create policy "Users can create hints"
  on public.hints for insert
  with check (auth.uid() is not null);

create policy "Users can access own lesson progress"
  on public.lesson_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
