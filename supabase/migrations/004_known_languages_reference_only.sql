alter table public.known_languages
  add column if not exists is_reference_only boolean not null default false;

comment on column public.known_languages.is_reference_only is
  'True when the row is from onboarding "other languages" (coarse B1); use for display/reference, not fine-grained proficiency.';
