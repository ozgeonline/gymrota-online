import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveMeal,mealTotals,scaledNutrients,quantityKey,quantityNumber,cleanQuantityChanges} from '../src/nutrition.js';
import {DemoStore,CloudStore} from '../src/store.js';
import {ingredientMealFixture} from './helpers/nutrition.mjs';
import {weekFixture} from './helpers/week-specific.mjs';
test('Ingredient quantities scale every nutrient and recalculate meal/day totals without changing the plan',()=>{
 const meals=ingredientMealFixture(),before=structuredClone(meals),date='2026-10-19';
 assert.deepEqual(scaledNutrients(meals[0].ingredients[0],50),{kcal:100,protein:7.5,carb:10,fat:2,sugar:1.5});
 const records={[quantityKey(date,'breakfast','sample_food')]:50};
 let resolved=meals.map(m=>effectiveMeal(m,date,records));assert.equal(resolved[0].nutrients.kcal,168);assert.equal(mealTotals(resolved).kcal,972);
 const drafts={[quantityKey(date,'breakfast','sample_milk')]:'100'};
 resolved=meals.map(m=>effectiveMeal(m,date,records,drafts));assert.equal(resolved[0].nutrients.kcal,134);assert.equal(mealTotals(resolved).kcal,938);assert.equal(resolved[0].ingredients[1].unit,'ml');assert.equal(resolved[0].ingredients[0].planned_quantity,100);
 assert.equal(effectiveMeal(meals[0],'2026-10-20',records,drafts).nutrients.kcal,268);assert.equal(effectiveMeal(meals[3],date,records,drafts).nutrients.kcal,268);assert.deepEqual(meals,before);
 const zero=Object.fromEntries(meals[0].ingredients.map(i=>[quantityKey(date,'breakfast',i.id),'0']));assert.deepEqual(effectiveMeal(meals[0],date,{},zero).nutrients,{kcal:0,protein:0,carb:0,fat:0,sugar:0});
});
test('Empty, negative, nonfinite and overprecise quantities are rejected instead of counted as zero',()=>{
 for(const value of ['',null,undefined,-1,5001,Infinity,NaN,'bad','1.234'])assert.equal(quantityNumber(value),null);
 assert.equal(quantityNumber('0'),0);assert.equal(quantityNumber('12,5'),12.5);
 assert.equal(effectiveMeal(ingredientMealFixture()[0],'2026-10-19',{}, {'2026-10-19:breakfast:sample_food':''}).nutrients.kcal,268);
 assert.throws(()=>cleanQuantityChanges([{meal_id:null,ingredient_id:'sample_food',quantity:12}]));
 assert.throws(()=>cleanQuantityChanges([{meal_id:'breakfast',ingredient_id:'sample_food',quantity:1},{meal_id:'breakfast',ingredient_id:'sample_food',quantity:2}]));
});
test('Edited quantities persist only for the selected date; a failed batch leaves prior values intact',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},s=new DemoStore(storage),p=await s.save(weekFixture());
 s.data.nutrition[p.id]={'2026-10-19':{meals:ingredientMealFixture()},'2026-10-20':{meals:ingredientMealFixture()}};s.persist();
 await s.saveQuantities(p.id,'2026-10-19',[{meal_id:'breakfast',ingredient_id:'sample_food',quantity:50},{meal_id:'breakfast',ingredient_id:'sample_milk',quantity:100}]);
 const loaded=await new DemoStore(storage).load(p.id);assert.equal(loaded.ingredientLogs['2026-10-19:breakfast:sample_food'],50);assert.equal(loaded.ingredientLogs['2026-10-20:breakfast:sample_food'],undefined);assert.equal(loaded.nutrition['2026-10-19'].meals[0].ingredients[0].quantity,100);assert.deepEqual(loaded.logs,{});assert.deepEqual(loaded.mealLogs,{});
 await assert.rejects(()=>s.saveQuantities(p.id,'2026-10-19',[{meal_id:'breakfast',ingredient_id:'unknown',quantity:5}]));
 storage.setItem=()=>{throw new Error('quota')};await assert.rejects(()=>s.saveQuantities(p.id,'2026-10-19',[{meal_id:'breakfast',ingredient_id:'sample_food',quantity:0},{meal_id:'dinner',ingredient_id:'sample_food',quantity:25}]));
 const after=await s.load(p.id);assert.equal(after.ingredientLogs['2026-10-19:breakfast:sample_food'],50);assert.equal(after.ingredientLogs['2026-10-19:dinner:sample_food'],undefined);
});
test('Cloud ingredient overrides paginate with stable keys and bulk saves retain owner/date identity',async()=>{
 let upsert;const rows=Array.from({length:600},(_,i)=>({session_date:'2026-10-19',meal_id:'breakfast',ingredient_id:'item_'+i,quantity:'50.25'}));
 const client={from(table){const filters=[],orders=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(k){orders.push(k);return q},async range(a,b){assert.deepEqual(filters,[['program_id','program'],['user_id','owner']]);if(table==='gym_ingredient_entries')assert.deepEqual(orders,['session_date','meal_id','ingredient_id']);return{error:null,data:table==='gym_ingredient_entries'?rows.slice(a,b+1):[]}},async upsert(body,options){upsert={table,body,options};return{error:null}}};return q}};
 const s=new CloudStore(client,{id:'owner'}),loaded=await s.load('program');assert.equal(Object.keys(loaded.ingredientLogs).length,600);assert.equal(loaded.ingredientLogs['2026-10-19:breakfast:item_599'],50.25);
 await s.saveQuantities('program','2026-10-20',[{meal_id:'dinner',ingredient_id:'sample_food',quantity:0}]);assert.deepEqual(upsert,{table:'gym_ingredient_entries',body:[{program_id:'program',user_id:'owner',session_date:'2026-10-20',meal_id:'dinner',ingredient_id:'sample_food',quantity:0}],options:{onConflict:'program_id,session_date,meal_id,ingredient_id'}});
});
