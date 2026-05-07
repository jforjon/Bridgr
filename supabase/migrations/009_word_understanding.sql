-- Per-user cache for "Understand deeper" API (arbitrary word strings; not tied to public.words)

create table if not exists public.word_understanding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  word text not null,
  language_code text not null,
  known_languages_key text not null,
  etymology text not null,
  grammar_context text not null,
  cross_language text not null,
  source_language_code text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_word_understanding_cache
  on public.word_understanding (user_id, language_code, known_languages_key, lower(trim(word)));

create index if not exists idx_word_understanding_lookup
  on public.word_understanding (user_id, language_code, known_languages_key);

alter table public.word_understanding enable row level security;

create policy "Users manage own word understanding cache"
  on public.word_understanding for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
