-- Optional ingredient details and private, date-specific quantity overrides.
begin;
create function public.gym_valid_meal_ingredients(doc jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare meal jsonb; ingredient jsonb; ids text[]; key text;
begin
 if jsonb_typeof(doc) is distinct from 'array' then return false; end if;
 for meal in select value from jsonb_array_elements(doc) loop
  if not(meal ? 'ingredients') then continue; end if;
  if jsonb_typeof(meal->'ingredients') is distinct from 'array' or jsonb_array_length(meal->'ingredients') not between 1 and 40 then return false; end if;
  ids:='{}';
  for ingredient in select value from jsonb_array_elements(meal->'ingredients') loop
   if jsonb_typeof(ingredient) is distinct from 'object' or not(ingredient ?& array['id','name','unit','quantity','per100']) then return false; end if;
   if coalesce(ingredient->>'id','') !~ '^[a-z][a-z0-9_-]{0,39}$' or (ingredient->>'id')=any(ids) then return false; end if;
   ids:=array_append(ids,ingredient->>'id');
   if jsonb_typeof(ingredient->'name') is distinct from 'string' or length(btrim(ingredient->>'name')) not between 1 and 160 then return false; end if;
   if jsonb_typeof(ingredient->'unit') is distinct from 'string' or ingredient->>'unit' not in('g','ml') then return false; end if;
   if jsonb_typeof(ingredient->'quantity') is distinct from 'number' or (ingredient->>'quantity')::numeric not between 0 and 5000 then return false; end if;
   if jsonb_typeof(ingredient->'per100') is distinct from 'object' then return false; end if;
   foreach key in array array['kcal','protein','carb','fat','sugar'] loop
    if jsonb_typeof(ingredient->'per100'->key) is distinct from 'number' or (ingredient->'per100'->>key)::numeric not between 0 and 5000 then return false; end if;
   end loop;
   if ingredient ? 'note' and(jsonb_typeof(ingredient->'note') is distinct from 'string' or length(ingredient->>'note')>300) then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;
alter table public.gym_nutrition_days add constraint gym_nutrition_ingredients_valid check(public.gym_valid_meal_ingredients(meals) is true);

create table public.gym_ingredient_entries(
 program_id uuid not null,user_id uuid not null default auth.uid(),session_date date not null,
 meal_id text not null,ingredient_id text not null,
 quantity numeric(10,2) not null check(quantity between 0 and 5000),
 updated_at timestamptz not null default now(),
 primary key(program_id,session_date,meal_id,ingredient_id),
 foreign key(program_id,user_id,session_date) references public.gym_nutrition_days(program_id,user_id,session_date) on delete cascade
);
create index gym_ingredient_entries_owner on public.gym_ingredient_entries(user_id,program_id,session_date);
create index gym_ingredient_entries_day on public.gym_ingredient_entries(program_id,user_id,session_date);

create function public.gym_ingredient_entry_guard() returns trigger
language plpgsql set search_path='' as $$
declare doc jsonb;
begin
 if TG_OP='UPDATE' and(new.program_id<>old.program_id or new.user_id<>old.user_id or new.session_date<>old.session_date or new.meal_id<>old.meal_id or new.ingredient_id<>old.ingredient_id) then raise exception 'Ingredient entry identity is immutable' using errcode='23514'; end if;
 select meals into doc from public.gym_nutrition_days where program_id=new.program_id and user_id=new.user_id and session_date=new.session_date for share;
 if not found then raise exception 'Meal day unavailable' using errcode='23503'; end if;
 if not exists(select 1 from jsonb_array_elements(doc) m cross join lateral jsonb_array_elements(coalesce(m->'ingredients','[]'::jsonb)) i where m->>'id'=new.meal_id and i->>'id'=new.ingredient_id) then raise exception 'Ingredient is not scheduled for this meal and date' using errcode='23514'; end if;
 new.updated_at:=now();return new;
end $$;
create trigger gym_ingredient_entry_guard before insert or update on public.gym_ingredient_entries for each row execute function public.gym_ingredient_entry_guard();

create function public.gym_ingredient_day_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.gym_ingredient_entries e where e.program_id=old.program_id and e.session_date=old.session_date and not exists(select 1 from jsonb_array_elements(new.meals) m cross join lateral jsonb_array_elements(coalesce(m->'ingredients','[]'::jsonb)) i where m->>'id'=e.meal_id and i->>'id'=e.ingredient_id)) then raise exception 'Tracked ingredient identities must be retained' using errcode='23514'; end if;
 return new;
end $$;
create trigger gym_ingredient_day_guard before update on public.gym_nutrition_days for each row execute function public.gym_ingredient_day_guard();

alter table public.gym_ingredient_entries enable row level security;
revoke all on public.gym_ingredient_entries from public,anon,authenticated;
grant select,insert,update,delete on public.gym_ingredient_entries to authenticated;
create policy gym_ingredient_entry_owner on public.gym_ingredient_entries for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on function public.gym_valid_meal_ingredients(jsonb),public.gym_ingredient_entry_guard(),public.gym_ingredient_day_guard() from public,anon,authenticated;
grant execute on function public.gym_valid_meal_ingredients(jsonb) to authenticated;
commit;
