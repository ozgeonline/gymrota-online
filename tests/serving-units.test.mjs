import test from 'node:test';
import assert from 'node:assert/strict';
import {SERVING_MEASURES,servingMeasure,servingQuantity,baseQuantityFromInput,effectiveMeal} from '../src/nutrition.js';
const food=(id,quantity=100)=>({id,name:id,unit:'g',quantity,per100:{kcal:200,fat:4,carb:20,protein:15,sugar:3}});
test('Household units convert pieces, dessert spoons, cobs and fractions into the existing weight basis',()=>{
 for(const id of ['egg','tomato','cucumber','apple','banana','walnut','almond','carrot','avocado','lemon','onion'])assert.equal(servingMeasure(food(id)).unit,'adet');
 assert.equal(servingMeasure(food('honey')).unit,'tatlı kaşığı');assert.equal(servingMeasure(food('corn_boiled')).unit,'koçan');assert.equal(servingMeasure(food('corn_dry')).unit,'g');
 assert.equal(servingQuantity(food('egg'),100),2);assert.equal(baseQuantityFromInput(food('egg'),0.5),25);
 assert.equal(baseQuantityFromInput(food('honey'),2),20);assert.equal(baseQuantityFromInput(food('corn_boiled'),1.5),150);
 assert.equal(baseQuantityFromInput(food('lemon'),0.5),25);assert.equal(baseQuantityFromInput(food('onion'),0.5),50);assert.equal(baseQuantityFromInput(food('almond'),10),12);
 assert.equal(baseQuantityFromInput(food('avocado'),0.25),50);
 for(const id of Object.keys(SERVING_MEASURES))for(const grams of [0,5,10,25,40,50,90,100,150])assert.equal(baseQuantityFromInput(food(id),servingQuantity(food(id),grams),grams),grams);
 assert.equal(baseQuantityFromInput(food('egg'),101),null);assert.equal(baseQuantityFromInput(food('honey'),-1),null);assert.equal(baseQuantityFromInput(food('egg'),''),null);
 const milk={...food('milk'),unit:'ml'};assert.equal(servingMeasure(milk).unit,'ml');assert.equal(baseQuantityFromInput(milk,200),200);
 assert.equal(servingMeasure(food('constructor')).unit,'g');assert.equal(baseQuantityFromInput(food('constructor'),50),50);
 const meal={id:'breakfast',ingredients:[food('egg')]};const changed=effectiveMeal(meal,'2026-10-19',{}, {'2026-10-19:breakfast:egg':String(baseQuantityFromInput(food('egg'),0.5))});assert.equal(changed.nutrients.kcal,50);
});
