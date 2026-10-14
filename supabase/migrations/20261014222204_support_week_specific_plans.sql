-- Optional week-specific plans and descriptive exercise instructions.
-- Existing repeating weekly programs keep their current behavior.
begin;
create or replace function public.gym_valid_definition(doc jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare d jsonb; e jsonb; day_numbers integer[] := '{}'; exercise_ids text[] := '{}'; n integer; w jsonb; seq integer:=0; item jsonb;
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
   elsif e->>'mode'='instruction' then
    if jsonb_typeof(e->'dose') is distinct from 'string' or length(btrim(e->>'dose')) not between 1 and 160 then return false; end if;
   else return false; end if;
   if e ? 'description' and (jsonb_typeof(e->'description') is distinct from 'string' or length(e->>'description')>1000) then return false; end if;
   if jsonb_typeof(e->'rest') is distinct from 'number' or (e->>'rest')::numeric not between 0 and 600 or (e->>'rest')::numeric<>trunc((e->>'rest')::numeric) then return false; end if;
   if e->'weight'<>'null'::jsonb and (jsonb_typeof(e->'weight') is distinct from 'number' or (e->>'weight')::numeric not between 0 and 500) then return false; end if;
   if jsonb_typeof(e->'video') is distinct from 'string' or length(e->>'video')>2048 or ((e->>'video')<>'' and (e->>'video')!~ '^https://[^[:space:]]+$') then return false; end if;
  end loop;
 end loop;
 if doc ? 'guidance' then
  if jsonb_typeof(doc->'guidance') is distinct from 'array' or jsonb_array_length(doc->'guidance')>10 then return false; end if;
  for item in select value from jsonb_array_elements(doc->'guidance') loop
   if jsonb_typeof(item) is distinct from 'string' or length(item#>>'{}')>1000 then return false; end if;
  end loop;
 end if;
 if doc ? 'weekPlans' then
  if jsonb_typeof(doc->'weekPlans') is distinct from 'array' or jsonb_array_length(doc->'weekPlans') not between 1 and 12 then return false; end if;
  for w in select value from jsonb_array_elements(doc->'weekPlans') loop
   if jsonb_typeof(w) is distinct from 'object' or not (w ?& array['week','title','instructions','days']) then return false; end if;
   if jsonb_typeof(w->'week') is distinct from 'number' or (w->>'week')::numeric<>seq then return false; end if;
   if jsonb_typeof(w->'title') is distinct from 'string' or length(w->>'title')>80 then return false; end if;
   if jsonb_typeof(w->'instructions') is distinct from 'array' or jsonb_array_length(w->'instructions')>10 then return false; end if;
   for item in select value from jsonb_array_elements(w->'instructions') loop
    if jsonb_typeof(item) is distinct from 'string' or length(item#>>'{}')>1000 then return false; end if;
   end loop;
   if public.gym_valid_definition(jsonb_build_object('days',w->'days')) is not true then return false; end if;
   if seq=0 and (w->'days')<>(doc->'days') then return false; end if;
   seq:=seq+1;
  end loop;
 end if;
 return true;
exception when others then return false;
end $$;

alter table public.gym_programs add constraint gym_program_week_count
 check(not(definition ? 'weekPlans') or jsonb_array_length(definition->'weekPlans')=weeks);
create or replace function public.gym_log_guard() returns trigger
language plpgsql set search_path='' as $$
declare p public.gym_programs%rowtype; chosen_days jsonb; week_index integer;
begin
 if TG_OP='UPDATE' and (new.program_id<>old.program_id or new.user_id<>old.user_id or new.session_date<>old.session_date) then raise exception 'Log identity is immutable' using errcode='23514'; end if;
 select * into p from public.gym_programs where id=new.program_id and user_id=new.user_id for share;
 if not found then raise exception 'Program unavailable' using errcode='23503'; end if;
 if new.session_date<p.start_date or new.session_date>=p.start_date+p.weeks*7 then raise exception 'Date outside program' using errcode='23514'; end if;
 week_index:=(new.session_date-p.start_date)/7;
 chosen_days:=coalesce(p.definition->'weekPlans'->week_index->'days',p.definition->'days');
 if TG_TABLE_NAME='gym_entries' then
  if TG_OP='UPDATE' and new.exercise_id<>old.exercise_id then raise exception 'Exercise identity is immutable' using errcode='23514'; end if;
  if not exists(select 1 from jsonb_array_elements(chosen_days) d, jsonb_array_elements(d->'exercises') e
    where (d->>'weekday')::integer=extract(isodow from new.session_date)::integer-1 and (e->>'id')::uuid=new.exercise_id) then
   raise exception 'Exercise is not scheduled for this date' using errcode='23514';
  end if;
 end if;
 new.updated_at:=now();return new;
end $$;
commit;
