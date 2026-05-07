-- Optional metadata for flashcards (e.g. lesson-scoped vocabulary)
alter table public.flashcards
  add column if not exists lesson_id uuid references public.lessons (id) on delete set null;

alter table public.flashcards
  add column if not exists language_code text;
