-- 016 — Language-context hardening + cleanup (UX audit 2026-07-11 backend notes)
--
-- NOTE: committed migrations 001–015 are behind the live schema (see
-- docs/ux-audit-2026-07-11.md, note 7). This file is written to be idempotent
-- so it can be run directly against the LIVE database via the SQL editor as
-- well as kept in the migration chain for a future `db dump` reconciliation.

-- ── 1. Durable "current course" pointer ────────────────────────────────────
-- The app currently resolves the active language by ordering
-- learning_languages.last_accessed_at DESC (bumped by the language switcher;
-- RLS UPDATE verified working 2026-07-11). This column is the cleaner,
-- explicit successor. Frontend swap point: components/LanguageSwitcher.tsx.
alter table public.profiles
  add column if not exists active_language_code text;

comment on column public.profiles.active_language_code is
  'Language code of the course the user is currently working in. Written by the language switcher; falls back to most recent learning_languages.last_accessed_at when null.';

-- ── 2. flashcards.language_code: enforce per-language integrity ────────────
-- Live data audit (2026-07-11): 0 of 52 rows null, so the backfill is a no-op
-- guard for older environments and the NOT NULL is safe.
update public.flashcards f
set language_code = c.language_code
from public.lessons le
join public.units u on u.id = le.unit_id
join public.courses c on c.id = u.course_id
where f.lesson_id = le.id
  and f.language_code is null;

do $$
begin
  if not exists (
    select 1 from public.flashcards where language_code is null
  ) then
    alter table public.flashcards alter column language_code set not null;
  else
    raise notice 'flashcards.language_code still has nulls; NOT NULL skipped';
  end if;
end $$;

-- Serves the practice due-count and due-cards queries
-- (user_id + language_code + next_review_date <= today).
create index if not exists flashcards_user_lang_due_idx
  on public.flashcards (user_id, language_code, next_review_date);

-- ── 3. learning_languages UPDATE policy (fresh-DB guard) ───────────────────
-- The live DB already allows owners to update their rows (verified
-- behaviorally); this makes fresh databases match.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'learning_languages'
      and cmd = 'UPDATE'
  ) then
    create policy "Users can update own learning languages"
      on public.learning_languages
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 4. Drop the template-leftover todos table (route deleted 2026-07-11) ───
drop table if exists public.todos;
