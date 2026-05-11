-- Shared cache for /api/evaluate (no RLS; reused across users)
-- show_correct: final API flag from the model (reveal answer only when wrong + true)

create table if not exists public.evaluations_cache (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  typed_answer text not null,
  correct_answer text not null,
  result text not null,
  message text,
  show_correct boolean not null default false,
  created_at timestamptz default now(),
  unique (word, typed_answer, correct_answer)
);

grant select, insert on public.evaluations_cache to authenticated;
grant select, insert on public.evaluations_cache to service_role;
