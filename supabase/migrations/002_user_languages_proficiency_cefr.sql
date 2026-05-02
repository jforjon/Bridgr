-- Migrate legacy proficiency values to CEFR (safe if column already uses CEFR)
update public.user_languages set proficiency = 'A2' where proficiency = 'basic';
update public.user_languages set proficiency = 'B1' where proficiency = 'conversational';
update public.user_languages set proficiency = 'C1' where proficiency = 'fluent';

alter table public.user_languages drop constraint if exists user_languages_proficiency_check;

alter table public.user_languages
  add constraint user_languages_proficiency_check
  check (proficiency in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
