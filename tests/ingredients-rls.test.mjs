import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {weekFixture} from './helpers/week-specific.mjs';
import {ingredientMealFixture} from './helpers/nutrition.mjs';
test('Ingredient quantities require ownership, correct date/meal/product and valid reference data',async()=>{
 const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const dir=new URL('../supabase/migrations/',import.meta.url);for(const file of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
 const a=crypto.randomUUID(),b=crypto.randomUUID();await db.query('insert into auth.users values($1),($2)',[a,b]);const as=async who=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who||'']);await db.exec('set role '+(who?'authenticated':'anon'));};
 await as(a);const p=(await db.query("insert into gym_programs(name,start_date,weeks,definition) values('Plan','2026-10-19',4,$1) returning id",[JSON.stringify(weekFixture().definition)])).rows[0];
 const meals=ingredientMealFixture();for(const date of ['2026-10-19','2026-10-20'])await db.query('insert into gym_nutrition_days(program_id,session_date,meals) values($1,$2,$3)',[p.id,date,JSON.stringify(meals)]);
 const save=async(date,meal,ingredient,quantity,uid=a)=>db.query('insert into gym_ingredient_entries(program_id,user_id,session_date,meal_id,ingredient_id,quantity) values($1,$2,$3,$4,$5,$6)',[p.id,uid,date,meal,ingredient,quantity]);
 await save('2026-10-19','breakfast','sample_food',50);await save('2026-10-20','breakfast','sample_food',0);
 assert.equal(Number((await db.query("select quantity from gym_ingredient_entries where session_date='2026-10-19'")).rows[0].quantity),50);assert.equal(Number((await db.query("select quantity from gym_ingredient_entries where session_date='2026-10-20'")).rows[0].quantity),0);
 for(const values of [['2026-10-21','breakfast','sample_food',2],['2026-10-19','unknown','sample_food',2],['2026-10-19','breakfast','unknown',2],['2026-10-19','dinner','sample_food',-1],['2026-10-19','dinner','sample_food',5001]])await assert.rejects(()=>save(...values));
 for(const mutate of [m=>m[0].ingredients[0].quantity=-1,m=>m[0].ingredients[0].unit=null,m=>delete m[0].ingredients[0].per100.kcal,m=>m[0].ingredients[1].id='sample_food']){const bad=ingredientMealFixture();mutate(bad);await assert.rejects(()=>db.query("insert into gym_nutrition_days(program_id,session_date,meals) values($1,'2026-10-21',$2)",[p.id,JSON.stringify(bad)]));}
 await assert.rejects(()=>db.query("update gym_ingredient_entries set user_id=$1 where program_id=$2",[b,p.id]));await assert.rejects(()=>db.query("update gym_ingredient_entries set session_date='2026-10-22' where program_id=$1",[p.id]));
 const removed=ingredientMealFixture();removed[0].ingredients.shift();await assert.rejects(()=>db.query("update gym_nutrition_days set meals=$1 where program_id=$2 and session_date='2026-10-19'",[JSON.stringify(removed),p.id]));
 await as(b);assert.equal((await db.query('select * from gym_ingredient_entries')).rows.length,0);assert.equal((await db.query('update gym_ingredient_entries set quantity=1 returning *')).rows.length,0);assert.equal((await db.query('delete from gym_ingredient_entries returning *')).rows.length,0);await assert.rejects(()=>save('2026-10-19','dinner','sample_food',10,b));
 await as(null);await assert.rejects(()=>db.query('select * from gym_ingredient_entries'));
 await as(a);assert.equal((await db.query('select * from gym_ingredient_entries')).rows.length,2);await db.query('delete from gym_programs where id=$1',[p.id]);assert.equal((await db.query('select * from gym_ingredient_entries')).rows.length,0);
 }finally{await db.close()}
});
