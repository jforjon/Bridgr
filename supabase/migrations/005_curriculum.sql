-- Curriculum content (seeded via API; service role inserts bypass RLS)

create table if not exists public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  topic_key text not null,
  topic_name text not null,
  topic_type text not null check (topic_type in ('vocabulary', 'grammar', 'reading', 'culture')),
  description text not null default '',
  source text not null default '',
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (language_code, cefr_level, topic_key)
);

create table if not exists public.curriculum_rules (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.curriculum_topics (id) on delete cascade,
  language_code text not null,
  rule_title text not null,
  rule_explanation text not null,
  examples jsonb not null default '[]'::jsonb,
  source text not null default '',
  created_at timestamptz not null default now(),
  unique (topic_id, rule_title)
);

create index if not exists idx_curriculum_rules_topic_id on public.curriculum_rules (topic_id);

create table if not exists public.curriculum_vocabulary (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  word text not null,
  translation_en text not null,
  part_of_speech text not null default '',
  frequency_rank int not null default 0,
  topic_key text not null,
  source text not null default '',
  created_at timestamptz not null default now(),
  unique (language_code, cefr_level, word)
);

create index if not exists idx_curriculum_vocab_lang_level on public.curriculum_vocabulary (language_code, cefr_level);

alter table public.curriculum_topics enable row level security;
alter table public.curriculum_rules enable row level security;
alter table public.curriculum_vocabulary enable row level security;

create policy "Authenticated users can read curriculum_topics"
  on public.curriculum_topics for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read curriculum_rules"
  on public.curriculum_rules for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read curriculum_vocabulary"
  on public.curriculum_vocabulary for select
  using (auth.role() = 'authenticated');
