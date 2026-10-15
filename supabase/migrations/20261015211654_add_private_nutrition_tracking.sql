-- Personal dated meal plans and independent meal completion records.
begin;
create function public.gym_valid_meals(doc jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare meal jsonb; ids text[]:='{}'; key text;
begin
 if jsonb_typeof(doc) is distinct from 'array' or jsonb_array_length(doc) not between 1 and 8 then return false; end if;
 for meal in select value from jsonb_array_elements(doc) loop
  if jsonb_typeof(meal) is distinct from 'object' or not(meal ?& array['id','label','title','description','nutrients']) then return false; end if;
  if coalesce(meal->>'id','') !~ '^[a-z][a-z0-9_-]{0,39}$' or (meal->>'id')=any(ids) then return false; end if;
  ids:=array_append(ids,meal->>'id');
  if jsonb_typeof(meal->'label') is distinct from 'string' or length(btrim(meal->>'label')) not between 1 and 40 then return false; end if;
  if jsonb_typeof(meal->'title') is distinct from 'string' or length(btrim(meal->>'title')) not between 1 and 120 then return false; end if;
  if jsonb_typeof(meal->'description') is distinct from 'string' or length(btrim(meal->>'description')) not between 1 and 4000 then return false; end if;
  if jsonb_typeof(meal->'nutrients') is distinct from 'object' then return false; end if;
  foreach key in array array['kcal','fat','carb','protein','sugar'] loop
   if jsonb_typeof(meal->'nutrients'->key) is distinct from 'number' or (meal->'nutrients'->>key)::numeric not between 0 and 5000 then return false; end if;
  end loop;
  if (meal->'nutrients'->>'sugar')::numeric>(meal->'nutrients'->>'carb')::numeric+0.1 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create table public.gym_nutrition_days(
 program_id uuid not null,user_id uuid not null default auth.uid(),session_date date not null,
 meals jsonb not null check(public.gym_valid_meals(meals) is true),
 notes text not null default '' check(length(notes)<=6000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(program_id,session_date),unique(program_id,user_id,session_date),
 foreign key(program_id,user_id) references public.gym_programs(id,user_id) on delete cascade
);
create index gym_nutrition_days_owner on public.gym_nutrition_days(user_id,program_id,session_date);
create table public.gym_meal_entries(
 program_id uuid not null,user_id uuid not null default auth.uid(),session_date date not null,
 meal_id text not null,completed boolean not null default false,updated_at timestamptz not null default now(),
 primary key(program_id,session_date,meal_id),
 foreign key(program_id,user_id,session_date) references public.gym_nutrition_days(program_id,user_id,session_date) on delete cascade
);
create index gym_meal_entries_owner on public.gym_meal_entries(user_id,program_id,session_date);
create index gym_meal_entries_day on public.gym_meal_entries(program_id,user_id,session_date);

create function public.gym_nutrition_day_guard() returns trigger
language plpgsql set search_path='' as $$
declare p public.gym_programs%rowtype;
begin
 if TG_OP='UPDATE' and(new.program_id<>old.program_id or new.user_id<>old.user_id or new.session_date<>old.session_date) then raise exception 'Meal day identity is immutable' using errcode='23514'; end if;
 select * into p from public.gym_programs where id=new.program_id and user_id=new.user_id for share;
 if not found then raise exception 'Program unavailable' using errcode='23503'; end if;
 if new.session_date<p.start_date or new.session_date>=p.start_date+p.weeks*7 then raise exception 'Date outside program' using errcode='23514'; end if;
 if TG_OP='UPDATE' then
  if exists(select 1 from public.gym_meal_entries e where e.program_id=old.program_id and e.session_date=old.session_date and not exists(select 1 from jsonb_array_elements(new.meals) m where m->>'id'=e.meal_id)) then raise exception 'Tracked meal identities must be retained' using errcode='23514'; end if;
  new.created_at:=old.created_at;
 end if;
 new.updated_at:=now();return new;
end $$;
create trigger gym_nutrition_day_guard before insert or update on public.gym_nutrition_days for each row execute function public.gym_nutrition_day_guard();

create function public.gym_meal_entry_guard() returns trigger
language plpgsql set search_path='' as $$
declare meal_doc jsonb;
begin
 if TG_OP='UPDATE' and(new.program_id<>old.program_id or new.user_id<>old.user_id or new.session_date<>old.session_date or new.meal_id<>old.meal_id) then raise exception 'Meal log identity is immutable' using errcode='23514'; end if;
 select meals into meal_doc from public.gym_nutrition_days where program_id=new.program_id and user_id=new.user_id and session_date=new.session_date for share;
 if not found then raise exception 'Meal day unavailable' using errcode='23503'; end if;
 if not exists(select 1 from jsonb_array_elements(meal_doc) m where m->>'id'=new.meal_id) then raise exception 'Meal is not scheduled for this date' using errcode='23514'; end if;
 new.updated_at:=now();return new;
end $$;
create trigger gym_meal_entry_guard before insert or update on public.gym_meal_entries for each row execute function public.gym_meal_entry_guard();

create function public.gym_nutrition_program_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if(new.start_date<>old.start_date or new.weeks<>old.weeks) and exists(select 1 from public.gym_nutrition_days where program_id=old.id) then raise exception 'Program with dated meals cannot be rescheduled' using errcode='23514'; end if;
 return new;
end $$;
create trigger gym_nutrition_program_guard before update on public.gym_programs for each row execute function public.gym_nutrition_program_guard();

alter table public.gym_nutrition_days enable row level security;
alter table public.gym_meal_entries enable row level security;
revoke all on public.gym_nutrition_days,public.gym_meal_entries from public,anon,authenticated;
grant select,insert,update,delete on public.gym_nutrition_days,public.gym_meal_entries to authenticated;
create policy gym_nutrition_day_owner on public.gym_nutrition_days for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy gym_meal_entry_owner on public.gym_meal_entries for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on function public.gym_valid_meals(jsonb),public.gym_nutrition_day_guard(),public.gym_meal_entry_guard(),public.gym_nutrition_program_guard() from public,anon,authenticated;
grant execute on function public.gym_valid_meals(jsonb) to authenticated;
commit;
