import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {weekFixture} from './helpers/week-specific.mjs';
import {PGlite} from '@electric-sql/pglite';
import {newExercise} from '../src/domain.js';
test('PostgreSQL migration: owner isolation, anonymous denial, validation and immutable tracking',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 const migrationDir=new URL('../supabase/migrations/',import.meta.url);
 for(const name of (await readdir(migrationDir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,migrationDir),'utf8'));
 const a=crypto.randomUUID(),b=crypto.randomUUID(),eid=crypto.randomUUID();
 await db.query('insert into auth.users values ($1),($2)',[a,b]);
 const as=async who=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who||'']);await db.exec('set role '+(who?'authenticated':'anon'));};
 const definition={days:[{weekday:0,title:'Kalça',exercises:[{...newExercise('Squat'),id:eid}]}]};
 await as(a);
 const insert=async(d=definition,uid=a)=>(await db.query("insert into public.gym_programs(name,start_date,weeks,definition,user_id) values ('Plan','2026-10-19',4,$1,$2) returning *",[JSON.stringify(d),uid])).rows[0];
 const p=await insert();
 const weekly=weekFixture();
 const wp=(await db.query("insert into gym_programs(name,start_date,weeks,definition,user_id) values ('Weekly plan','2026-10-19',4,$1,$2) returning *",[JSON.stringify(weekly.definition),a])).rows[0];
 const weekTwoId=weekly.definition.weekPlans[1].days[0].exercises[0].id;
 await db.query("insert into gym_entries(program_id,session_date,exercise_id,completed) values ($1,'2026-10-26',$2,true)",[wp.id,weekTwoId]);
 await assert.rejects(()=>db.query("insert into gym_entries(program_id,session_date,exercise_id) values ($1,'2026-10-26',$2)",[wp.id,weekly.definition.days[0].exercises[0].id]));
 const badWeek=structuredClone(weekly.definition);badWeek.weekPlans[1].week=4;await assert.rejects(()=>insert(badWeek));
 const badDose=structuredClone(weekly.definition);badDose.weekPlans[1].days[0].exercises[0].dose=null;await assert.rejects(()=>insert(badDose));
 const shortWeek=structuredClone(weekly.definition);shortWeek.weekPlans.pop();await assert.rejects(()=>insert(shortWeek));

 const malformed=[{}, {days:null}, {days:[]}, {days:[null]}];
 for(const key of ['weekday','title','exercises']){const d=structuredClone(definition);d.days[0][key]=null;malformed.push(d);}
 for(const key of ['id','name','mode','sets','reps','rest','video']){const d=structuredClone(definition);d.days[0].exercises[0][key]=null;malformed.push(d);}
 for(const d of malformed)await assert.rejects(()=>insert(d));
 await assert.rejects(()=>insert(definition,b));
 await db.query("insert into gym_entries(program_id,session_date,exercise_id,completed) values ($1,'2026-10-19',$2,true)",[p.id,eid]);
 await db.query("insert into gym_notes(program_id,session_date,note) values ($1,'2026-10-19','Özel not')",[p.id]);
 await assert.rejects(()=>db.query("insert into gym_entries(program_id,session_date,exercise_id) values ($1,'2026-10-20',$2)",[p.id,eid]));
 await assert.rejects(()=>db.query("insert into gym_notes(program_id,session_date,note) values ($1,'2027-01-01','x')",[p.id]));
 await assert.rejects(()=>db.query("update gym_programs set weeks=5 where id=$1",[p.id]));
 await assert.rejects(()=>db.query("update gym_programs set user_id=$1 where id=$2",[b,p.id]));
 const changed=await db.query("update gym_programs set name='Güncel',version=99 where id=$1 returning version",[p.id]);assert.equal(changed.rows[0].version,2);
 await as(b);
 for(const table of ['gym_programs','gym_entries','gym_notes']){
  assert.equal((await db.query(`select * from ${table}`)).rows.length,0);
  assert.equal((await db.query(`delete from ${table} returning *`)).rows.length,0);
 }
 assert.equal((await db.query("update gym_programs set name='attack' where id=$1 returning *",[p.id])).rows.length,0);
 await assert.rejects(()=>db.query("insert into gym_entries(program_id,user_id,session_date,exercise_id) values ($1,$2,'2026-10-19',$3)",[p.id,b,eid]));
 await assert.rejects(()=>db.query("insert into gym_notes(program_id,user_id,session_date,note) values ($1,$2,'2026-10-19','attack')",[p.id,a]));
 await assert.rejects(()=>db.query("insert into gym_notes(program_id,user_id,session_date,note) values ($1,$2,'2026-10-19','attack')",[p.id,b]));
 await as(null);for(const table of ['gym_programs','gym_entries','gym_notes'])await assert.rejects(()=>db.query(`select * from ${table}`));
 await as(a);assert.equal((await db.query('select note from gym_notes')).rows[0].note,'Özel not');
 await db.query('delete from gym_programs where id=$1',[wp.id]);
 await db.query('delete from gym_programs where id=$1',[p.id]);assert.equal((await db.query('select * from gym_entries')).rows.length,0);assert.equal((await db.query('select * from gym_notes')).rows.length,0);
 }finally{await db.close()}
});
