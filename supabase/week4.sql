-- Apply after schema.sql and week3.sql. Safe to rerun; preserves existing rows.
begin;

create table if not exists public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists generation_requests_user_time on public.generation_requests(user_id, created_at);

create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  scene text not null check (char_length(scene) between 12 and 400),
  caption text not null check (char_length(caption) between 1 and 240),
  style text not null check (style in ('Deadpan', 'Chronically online', 'Midwest meets NYC')),
  challenge_date date,
  created_at timestamptz not null default now()
);
create index if not exists captions_created_at on public.captions(created_at desc);
create index if not exists captions_challenge_date on public.captions(challenge_date);

-- Private generation provenance; no user identity is exposed on the public caption.
create table if not exists public.generations (
  id uuid primary key references public.generation_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  caption_id uuid not null unique references public.captions(id) on delete cascade,
  prompt text not null,
  system_prompt text not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index if not exists generations_user on public.generations(user_id);

create table if not exists public.caption_votes (
  caption_id uuid not null references public.captions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (caption_id, user_id)
);
create index if not exists caption_votes_user on public.caption_votes(user_id);

-- Enable RLS on ALL application tables, including tables added outside this repo.
-- Supabase-managed auth/storage schemas retain their platform-managed policies.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

revoke all on public.generation_requests, public.generations, public.captions, public.caption_votes from anon, authenticated;
grant select on public.captions to anon, authenticated;
grant select on public.generations to authenticated;
grant select on public.caption_votes to authenticated;
grant insert (caption_id, user_id, value), update (value) on public.caption_votes to authenticated;
-- PostgREST upsert includes key columns in its update list; policies require ownership.
grant update (caption_id, user_id) on public.caption_votes to authenticated;
grant all on public.generation_requests, public.generations, public.captions, public.caption_votes to service_role;

drop policy if exists "Public captions" on public.captions;
create policy "Public captions" on public.captions for select to anon, authenticated using (true);
drop policy if exists "Own generation history" on public.generations;
create policy "Own generation history" on public.generations for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Read own votes" on public.caption_votes;
create policy "Read own votes" on public.caption_votes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own votes" on public.caption_votes;
create policy "Insert own votes" on public.caption_votes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own votes" on public.caption_votes;
create policy "Update own votes" on public.caption_votes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Keep vote identity and target immutable, even for direct API callers.
create or replace function public.keep_vote_identity() returns trigger
language plpgsql set search_path = '' as $$ begin
  if new.user_id <> old.user_id or new.caption_id <> old.caption_id then
    raise exception 'Vote identity is immutable';
  end if;
  return new;
end $$;
drop trigger if exists keep_vote_identity on public.caption_votes;
create trigger keep_vote_identity before update on public.caption_votes for each row execute function public.keep_vote_identity();
revoke all on function public.keep_vote_identity() from public, anon, authenticated;

-- No direct client access to quota rows or publishing functions.
create or replace function public.reserve_generation(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare request_id uuid; day_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  day_start := date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York';
  if (select count(*) from public.generation_requests where user_id = p_user_id and created_at >= day_start) >= 10 then
    raise exception 'daily_limit';
  end if;
  insert into public.generation_requests(user_id) values (p_user_id) returning id into request_id;
  return request_id;
end $$;
revoke all on function public.reserve_generation(uuid) from public, anon, authenticated;
grant execute on function public.reserve_generation(uuid) to service_role;

create or replace function public.publish_generation(
  p_request_id uuid, p_user_id uuid, p_scene text, p_style text, p_caption text,
  p_prompt text, p_system_prompt text, p_model text, p_challenge_date date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_caption_id uuid;
begin
  perform 1 from public.generation_requests where id = p_request_id and user_id = p_user_id for update;
  if not found then raise exception 'Invalid generation reservation'; end if;
  -- A retry returns the existing caption, never duplicates it.
  select caption_id into new_caption_id from public.generations where id = p_request_id;
  if found then return new_caption_id; end if;
  insert into public.captions(scene, caption, style, challenge_date)
    values(p_scene, p_caption, p_style, p_challenge_date) returning id into new_caption_id;
  insert into public.generations(id, user_id, caption_id, prompt, system_prompt, model)
    values(p_request_id, p_user_id, new_caption_id, p_prompt, p_system_prompt, p_model);
  return new_caption_id;
end $$;
revoke all on function public.publish_generation(uuid, uuid, text, text, text, text, text, text, date) from public, anon, authenticated;
grant execute on function public.publish_generation(uuid, uuid, text, text, text, text, text, text, date) to service_role;

-- Deliberately narrow definer function: reveals aggregate scores, never voter IDs.
-- Bounded, typed parameters; no dynamic SQL or access to profiles/prompts.
create or replace function public.caption_feed(
  p_sort text default 'new', p_day date default null, p_id uuid default null,
  p_offset integer default 0
) returns table(id uuid, scene text, caption text, style text, challenge_date date, created_at timestamptz, score bigint, vote_count bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.scene, c.caption, c.style, c.challenge_date, c.created_at,
    coalesce(sum(v.value), 0)::bigint as score, count(v.user_id)::bigint as vote_count
  from public.captions c left join public.caption_votes v on c.id = v.caption_id
  where (p_day is null or c.challenge_date = p_day) and (p_id is null or c.id = p_id)
  group by c.id
  order by case when p_sort = 'top' then coalesce(sum(v.value), 0) end desc, c.created_at desc, c.id
  limit 13 offset least(greatest(p_offset, 0), 12000);
$$;
revoke all on function public.caption_feed(text, date, uuid, integer) from public, anon, authenticated;
grant execute on function public.caption_feed(text, date, uuid, integer) to anon, authenticated, service_role;
commit;
