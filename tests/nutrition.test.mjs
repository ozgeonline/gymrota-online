import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoStore,CloudStore} from '../src/store.js';
import {mealTotals,mealProgress,nutrientText} from '../src/nutrition.js';
import {weekFixture} from './helpers/week-specific.mjs';
import {mealFixture} from './helpers/nutrition.mjs';
test('Nutrition totals, decimal display, and dated meal progress stay consistent',()=>{
 const meals=mealFixture();assert.deepEqual(mealTotals(meals),{kcal:1060,protein:73.2,carb:100.8,fat:34,sugar:24.4});
 assert.equal(nutrientText(73.2,'protein'),'73,2');assert.equal(nutrientText(1060,'kcal'),'1.060');
 assert.deepEqual(mealProgress({meals},'2026-10-19',{'2026-10-20:breakfast':true,'2026-10-19:breakfast':true}),{done:1,total:4});
});
test('Meal ticks persist by date independently of gym and roll back failed writes',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const s=new DemoStore(storage),p=await s.save(weekFixture()),meals=mealFixture();
 s.data.nutrition[p.id]={'2026-10-19':{meals},'2026-10-20':{meals}};s.persist();
 await s.checkMeal(p.id,'2026-10-19','breakfast',true);
 let loaded=await new DemoStore(storage).load(p.id);assert.equal(loaded.mealLogs['2026-10-19:breakfast'],true);assert.deepEqual(loaded.logs,{});assert.equal(loaded.mealLogs['2026-10-20:breakfast'],undefined);
 await assert.rejects(()=>s.checkMeal(p.id,'2026-10-19','unknown',true));
 await assert.rejects(()=>s.checkMeal(p.id,'2026-10-21','breakfast',true));
 storage.setItem=()=>{throw new Error('quota')};await assert.rejects(()=>s.checkMeal(p.id,'2026-10-19','dinner',true));
 assert.equal((await s.load(p.id)).mealLogs['2026-10-19:dinner'],undefined);
});
test('Cloud meals use owner and program filters and save one meal without replacing other ticks',async()=>{
 const calls=[];const mock={from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},async range(){assert.deepEqual(filters,[['program_id','program'],['user_id','owner']]);return{data:table==='gym_nutrition_days'?[{session_date:'2026-10-19',meals:mealFixture()}]:table==='gym_meal_entries'?[{session_date:'2026-10-19',meal_id:'breakfast',completed:true}]:[],error:null}},async upsert(body,options){calls.push({table,body,options});return{error:null}}};return q}};
 const s=new CloudStore(mock,{id:'owner'}),result=await s.load('program');assert.equal(result.nutrition['2026-10-19'].meals.length,4);assert.equal(result.mealLogs['2026-10-19:breakfast'],true);
 await s.checkMeal('program','2026-10-20','dinner',true);assert.deepEqual(calls,[{table:'gym_meal_entries',body:{program_id:'program',user_id:'owner',session_date:'2026-10-20',meal_id:'dinner',completed:true},options:{onConflict:'program_id,session_date,meal_id'}}]);
});
