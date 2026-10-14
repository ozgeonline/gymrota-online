-- Disposable database-role test. All test users and records roll back inside
-- the nested exception block; this does not create usable login accounts.
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid();
 pid uuid; n integer; blocked boolean;
begin
 begin
  insert into auth.users(id,aud,role,email) values
   (a,'authenticated','authenticated',a::text||'@example.invalid'),
   (b,'authenticated','authenticated',b::text||'@example.invalid');
  perform set_config('request.jwt.claim.sub',a::text,true);
  execute 'set local role authenticated';
  insert into public.gym_programs(name,start_date,weeks,definition)
   values('RLS isolation check','2026-10-19',1,
    jsonb_build_object('days',jsonb_build_array(jsonb_build_object('weekday',0,'title','Test','exercises',jsonb_build_array(
     jsonb_build_object('id',eid,'name','Squat','mode','reps','sets',2,'reps',10,'seconds',null,'weight',4,'rest',60,'video','')
    ))))) returning id into pid;
  insert into public.gym_entries(program_id,session_date,exercise_id,completed) values(pid,'2026-10-19',eid,true);
  insert into public.gym_notes(program_id,session_date,note) values(pid,'2026-10-19','Private test note');
  select count(*) into n from public.gym_programs where id=pid;
  if n<>1 then raise exception 'Owner cannot read own program';end if;
  perform set_config('request.jwt.claim.sub',b::text,true);
  select count(*) into n from public.gym_programs where id=pid;
  if n<>0 then raise exception 'Program visible across users';end if;
  select count(*) into n from public.gym_entries where program_id=pid;
  if n<>0 then raise exception 'Ticks visible across users';end if;
  select count(*) into n from public.gym_notes where program_id=pid;
  if n<>0 then raise exception 'Notes visible across users';end if;
  update public.gym_programs set name='Foreign update' where id=pid;
  get diagnostics n=row_count;if n<>0 then raise exception 'Foreign update accepted';end if;
  delete from public.gym_programs where id=pid;
  get diagnostics n=row_count;if n<>0 then raise exception 'Foreign delete accepted';end if;
  blocked:=false;
  begin
   insert into public.gym_notes(program_id,user_id,session_date,note) values(pid,b,'2026-10-19','Forged owner');
  exception when foreign_key_violation or check_violation or insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Forged ownership was accepted';end if;
  execute 'set local role anon';blocked:=false;
  begin perform 1 from public.gym_programs;exception when insufficient_privilege then blocked:=true;end;
  if not blocked then raise exception 'Anonymous table access accepted';end if;
  execute 'reset role';
  raise exception using errcode='PT001',message='Roll back successful test fixtures';
 exception when sqlstate 'PT001' then null;
 end;
end $test$;
select 'Database owner isolation passed; test fixtures rolled back' as result;
