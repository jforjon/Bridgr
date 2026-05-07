alter table public.word_understanding
  add column if not exists hook text;

alter table public.word_understanding
  add column if not exists hook_type text;

alter table public.word_understanding
  add column if not exists source_language text;
