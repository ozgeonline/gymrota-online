import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {weekFixture} from './helpers/week-specific.mjs';
import {mealFixture} from './helpers/nutrition.mjs';
test('Meal plans and ticks enforce owner isolation, valid dates, meal identity and anonymous denial',async()=>{
 const db=new PGlite();
 try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const dir=new URL('../supabase/migrations/',import.meta.url);for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,dir),'utf8'));
 const a=crypto.randomUUID(),b=crypto.randomUUID();await db.query('insert into auth.users values($1),($2)',[a,b]);
 const as=async who=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who||'']);await db.exec('set role '+(who?'authenticated':'anon'));};
 await as(a);const p=(await db.query("insert into gym_programs(name,start_date,weeks,definition) values('Plan','2026-10-19',4,$1) returning id",[JSON.stringify(weekFixture().definition)])).rows[0];
 const meals=mealFixture(),insert=async(date='2026-10-19',doc=meals,uid=a)=>db.query('insert into gym_nutrition_days(program_id,user_id,session_date,meals) values($1,$2,$3,$4)',[p.id,uid,date,JSON.stringify(doc)]);
 await insert();await insert('2026-10-20');await insert('2026-10-21');await insert('2026-11-15');
 await assert.rejects(()=>insert('2026-10-18'));await assert.rejects(()=>insert('2026-11-16'));await assert.rejects(()=>insert('2026-10-22',[]));
 const bad=mealFixture();bad[0].nutrients.protein=-1;await assert.rejects(()=>insert('2026-10-22',bad));
 const missing=mealFixture();delete missing[0].nutrients.kcal;await assert.rejects(()=>insert('2026-10-22',missing));
 const duplicate=mealFixture();duplicate[1].id=duplicate[0].id;await assert.rejects(()=>insert('2026-10-22',duplicate));
 await assert.rejects(()=>insert('2026-10-22',meals,b));
 await db.query("insert into gym_meal_entries(program_id,session_date,meal_id,completed) values($1,'2026-10-19','breakfast',true)",[p.id]);
 await db.query("insert into gym_meal_entries(program_id,session_date,meal_id,completed) values($1,'2026-10-20','breakfast',false)",[p.id]);
 await assert.rejects(()=>db.query("insert into gym_meal_entries(program_id,session_date,meal_id) values($1,'2026-10-19','unknown')",[p.id]));
 await assert.rejects(()=>db.query("insert into gym_meal_entries(program_id,session_date,meal_id) values($1,'2026-10-22','breakfast')",[p.id]));
 await assert.rejects(()=>db.query("update gym_programs set start_date='2026-10-20' where id=$1",[p.id]));
 await assert.rejects(()=>db.query("update gym_meal_entries set session_date='2026-10-21' where program_id=$1",[p.id]));
 await assert.rejects(()=>db.query("update gym_nutrition_days set user_id=$1 where program_id=$2",[b,p.id]));
 await assert.rejects(()=>db.query("update gym_nutrition_days set meals=$1 where program_id=$2 and session_date='2026-10-19'",[JSON.stringify(meals.slice(1)),p.id]));
 assert.equal((await db.query("select completed from gym_meal_entries where session_date='2026-10-19'")).rows[0].completed,true);assert.equal((await db.query("select completed from gym_meal_entries where session_date='2026-10-20'")).rows[0].completed,false);
 await as(b);for(const table of ['gym_nutrition_days','gym_meal_entries']){assert.equal((await db.query('select * from '+table)).rows.length,0);assert.equal((await db.query('delete from '+table+' returning *')).rows.length,0);}
 assert.equal((await db.query("update gym_meal_entries set completed=false where program_id=$1 returning *",[p.id])).rows.length,0);
 await assert.rejects(()=>insert('2026-10-22',meals,b));await assert.rejects(()=>db.query("insert into gym_meal_entries(program_id,user_id,session_date,meal_id) values($1,$2,'2026-10-19','dinner')",[p.id,b]));
 await as(null);for(const table of ['gym_nutrition_days','gym_meal_entries'])await assert.rejects(()=>db.query('select * from '+table));
 await as(a);assert.equal((await db.query('select * from gym_nutrition_days')).rows.length,4);await db.query('delete from gym_programs where id=$1',[p.id]);assert.equal((await db.query('select * from gym_meal_entries')).rows.length,0);
 }finally{await db.close()}
});
