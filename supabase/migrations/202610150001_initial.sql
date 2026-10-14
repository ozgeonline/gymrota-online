-- GymRota Online · Supabase migration. Run as database owner via SQL Editor.
-- No plaintext passwords; identity is managed exclusively by Supabase Auth.
begin;
create or replace function public.gym_valid_definition(doc jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare d jsonb; e jsonb; day_numbers integer[] := '{}'; exercise_ids text[] := '{}'; n integer;
begin
 if jsonb_typeof(doc) is distinct from 'object' or jsonb_typeof(doc->'days') is distinct from 'array' then return false; end if;
 if jsonb_array_length(doc->'days') not between 1 and 7 then return false; end if;
 for d in select value from jsonb_array_elements(doc->'days') loop
  if not (d ?& array['weekday','title','exercises']) or jsonb_typeof(d->'weekday') is distinct from 'number' then return false; end if;
  n := (d->>'weekday')::integer;
  if n not between 0 and 6 or (d->>'weekday')::numeric <> n or n=any(day_numbers) then return false; end if;
  day_numbers:=array_append(day_numbers,n);
  if jsonb_typeof(d->'title') is distinct from 'string' or length(btrim(d->>'title')) not between 1 and 80 then return false; end if;
  if jsonb_typeof(d->'exercises') is distinct from 'array' or jsonb_array_length(d->'exercises') not between 1 and 30 then return false; end if;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   if not (e ?& array['id','name','mode','rest','video','weight']) then return false; end if;
   if coalesce(e->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or (e->>'id')=any(exercise_ids) then return false; end if;
   exercise_ids:=array_append(exercise_ids,e->>'id');
   if jsonb_typeof(e->'name') is distinct from 'string' or length(btrim(e->>'name')) not between 1 and 120 then return false; end if;
   if e->>'mode' = 'reps' then
    if not(e ?& array['sets','reps']) or jsonb_typeof(e->'sets') is distinct from 'number' or jsonb_typeof(e->'reps') is distinct from 'number' then return false; end if;
    if (e->>'sets')::numeric not between 1 and 20 or (e->>'sets')::numeric<>trunc((e->>'sets')::numeric) or (e->>'reps')::numeric not between 1 and 200 or (e->>'reps')::numeric<>trunc((e->>'reps')::numeric) then return false; end if;
   elsif e->>'mode'='time' then
    if not(e ? 'seconds') or jsonb_typeof(e->'seconds') is distinct from 'number' or (e->>'seconds')::numeric not between 5 and 7200 or (e->>'seconds')::numeric<>trunc((e->>'seconds')::numeric) then return false; end if;
   else return false; end if;
   if jsonb_typeof(e->'rest') is distinct from 'number' or (e->>'rest')::numeric not between 0 and 600 or (e->>'rest')::numeric<>trunc((e->>'rest')::numeric) then return false; end if;
   if e->'weight'<>'null'::jsonb and (jsonb_typeof(e->'weight') is distinct from 'number' or (e->>'weight')::numeric not between 0 and 500) then return false; end if;
   if jsonb_typeof(e->'video') is distinct from 'string' or length(e->>'video')>2048 or ((e->>'video')<>'' and (e->>'video')!~ '^https://[^[:space:]]+$') then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;

create table public.gym_programs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 80),
 start_date date not null check(start_date between date '2020-01-01' and date '2100-12-31'),
 weeks integer not null check(weeks between 1 and 12),
 definition jsonb not null check(public.gym_valid_definition(definition) is true),
 version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,user_id)
);
create index gym_programs_owner on public.gym_programs(user_id,created_at desc);
create table public.gym_entries (
 program_id uuid not null,user_id uuid not null default auth.uid(),
 session_date date not null,exercise_id uuid not null,completed boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(program_id,session_date,exercise_id),
 foreign key(program_id,user_id) references public.gym_programs(id,user_id) on delete cascade
);
create index gym_entries_owner on public.gym_entries(user_id,program_id);
create table public.gym_notes (
 program_id uuid not null,user_id uuid not null default auth.uid(),session_date date not null,
 note text not null default '' check(length(note)<=2000),updated_at timestamptz not null default now(),
 primary key(program_id,session_date),
 foreign key(program_id,user_id) references public.gym_programs(id,user_id) on delete cascade
);
create index gym_notes_owner on public.gym_notes(user_id,program_id);

create or replace function public.gym_program_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.user_id<>old.user_id then raise exception 'Program ownership is immutable' using errcode='23514'; end if;
 if (new.start_date<>old.start_date or new.weeks<>old.weeks) and
 (exists(select 1 from public.gym_entries where program_id=old.id) or exists(select 1 from public.gym_notes where program_id=old.id)) then
  raise exception 'Tracked program dates cannot change; create a new program' using errcode='23514';
 end if;
 new.version:=old.version+1;new.created_at:=old.created_at;new.updated_at:=now();return new;
end $$;
create trigger gym_program_guard before update on public.gym_programs for each row execute function public.gym_program_guard();

create or replace function public.gym_log_guard() returns trigger
language plpgsql set search_path='' as $$
declare p public.gym_programs%rowtype;
begin
 if TG_OP='UPDATE' and (new.program_id<>old.program_id or new.user_id<>old.user_id or new.session_date<>old.session_date) then raise exception 'Log identity is immutable' using errcode='23514'; end if;
 select * into p from public.gym_programs where id=new.program_id and user_id=new.user_id for share;
 if not found then raise exception 'Program unavailable' using errcode='23503'; end if;
 if new.session_date<p.start_date or new.session_date>=p.start_date+p.weeks*7 then raise exception 'Date outside program' using errcode='23514'; end if;
 if TG_TABLE_NAME='gym_entries' then
  if TG_OP='UPDATE' and new.exercise_id<>old.exercise_id then raise exception 'Exercise identity is immutable' using errcode='23514'; end if;
  if not exists(select 1 from jsonb_array_elements(p.definition->'days') d, jsonb_array_elements(d->'exercises') e
    where (d->>'weekday')::integer=extract(isodow from new.session_date)::integer-1 and (e->>'id')::uuid=new.exercise_id) then
   raise exception 'Exercise is not scheduled for this date' using errcode='23514';
  end if;
 end if;
 new.updated_at:=now();return new;
end $$;
create trigger gym_entry_guard before insert or update on public.gym_entries for each row execute function public.gym_log_guard();
create trigger gym_note_guard before insert or update on public.gym_notes for each row execute function public.gym_log_guard();

alter table public.gym_programs enable row level security;
alter table public.gym_entries enable row level security;
alter table public.gym_notes enable row level security;
revoke all on public.gym_programs,public.gym_entries,public.gym_notes from anon,authenticated;
grant select,insert,update,delete on public.gym_programs,public.gym_entries,public.gym_notes to authenticated;
create policy gym_program_owner on public.gym_programs for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy gym_entry_owner on public.gym_entries for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy gym_note_owner on public.gym_notes for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on function public.gym_valid_definition(jsonb),public.gym_program_guard(),public.gym_log_guard() from public,anon;
grant execute on function public.gym_valid_definition(jsonb) to authenticated;
commit;
