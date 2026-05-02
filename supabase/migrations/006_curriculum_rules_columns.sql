-- curriculum_rules: language_code + dedupe on (topic_id, rule_title); drop legacy rule_index

alter table public.curriculum_rules
  add column if not exists language_code text;

update public.curriculum_rules r
set language_code = t.language_code
from public.curriculum_topics t
where r.topic_id = t.id
  and (r.language_code is null or r.language_code = '');

alter table public.curriculum_rules
  alter column language_code set not null;

alter table public.curriculum_rules
  drop column if exists rule_index;

alter table public.curriculum_rules
  drop constraint if exists curriculum_rules_topic_id_rule_index_key;

alter table public.curriculum_rules
  drop constraint if exists curriculum_rules_topic_id_rule_title_key;

alter table public.curriculum_rules
  add constraint curriculum_rules_topic_id_rule_title_key unique (topic_id, rule_title);
