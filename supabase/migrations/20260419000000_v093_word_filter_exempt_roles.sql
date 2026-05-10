alter table public.servers
add column if not exists word_filter_exempt_role_ids uuid[] not null default '{}';

create index if not exists idx_servers_word_filter_exempt_role_ids
on public.servers
using gin (word_filter_exempt_role_ids);