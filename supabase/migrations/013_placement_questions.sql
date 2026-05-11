-- Bank of placement questions per target language (seeded by scripts/seed-placement-questions.ts)

create table if not exists public.placement_questions (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,
  section text not null
    check (section in ('vocabulary', 'grammar', 'reading', 'writing')),
  cefr_level text not null
    check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  prompt text not null,
  context_text text,
  options jsonb,
  correct_answer text not null,
  order_index int not null,
  created_at timestamptz not null default now(),
  unique (language_code, order_index)
);

create index if not exists idx_placement_questions_language
  on public.placement_questions (language_code);

alter table public.placement_questions enable row level security;

-- Service role bypasses RLS; allow authenticated users to read questions for placement UI
create policy "placement_questions_select_authenticated"
  on public.placement_questions for select
  to authenticated
  using (true);
