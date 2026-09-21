-- Public sample content for the Week 2 database list.
create table if not exists public.jokes (
  id bigint generated always as identity primary key,
  setup text not null,
  punchline text not null,
  created_at timestamptz not null default now()
);

alter table public.jokes enable row level security;

revoke all on public.jokes from anon, authenticated;
grant select on public.jokes to anon, authenticated;

drop policy if exists "Anyone can read jokes" on public.jokes;
create policy "Anyone can read jokes"
  on public.jokes for select
  to anon, authenticated
  using (true);

insert into public.jokes (setup, punchline)
select setup, punchline
from (values
  ('Why did the database break up with the spreadsheet?', 'It needed more space for relationships.'),
  ('Why was the developer calm during the outage?', 'They had a backup plan.'),
  ('What do you call a joke stored in a table?', 'A punchline with a primary key.'),
  ('Why did the query go to comedy class?', 'It wanted better delivery.')
) as samples(setup, punchline)
where not exists (select 1 from public.jokes);
