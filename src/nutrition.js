export const NUTRIENTS=[['kcal','Enerji','kcal'],['protein','Protein','g'],['carb','Karbonhidrat','g'],['fat','Yağ','g'],['sugar','Şeker','g']];
export function mealTotals(meals=[]){return Object.fromEntries(NUTRIENTS.map(([key])=>[key,Math.round(meals.reduce((sum,meal)=>sum+Number(meal.nutrients?.[key]||0),0)*10)/10]));}
export function nutrientText(value,key,digits=key==='kcal'?0:1){return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);}
export function mealProgress(day,date,logs){const meals=day?.meals||[];return{done:meals.filter(m=>logs[date+':'+m.id]===true).length,total:meals.length};}
export function quantityKey(date,mealId,ingredientId){return date+':'+mealId+':'+ingredientId;}
export function quantityNumber(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(String(value).replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=5000&&Math.abs(n*100-Math.round(n*100))<0.000001?n:null;}
export function quantityText(value){return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(value);}
export function scaledNutrients(ingredient,quantity){return Object.fromEntries(NUTRIENTS.map(([key])=>[key,Number(ingredient.per100[key])*quantity/100]));}
export function effectiveMeal(meal,date,records={},drafts={}){
 if(!meal.ingredients?.length)return meal;
 const ingredients=meal.ingredients.map(ingredient=>{
  const key=quantityKey(date,meal.id,ingredient.id),saved=Number(records[key]??ingredient.quantity);
  const quantity=Object.hasOwn(drafts,key)?quantityNumber(drafts[key])??saved:saved;
  return{...ingredient,planned_quantity:ingredient.quantity,quantity,nutrients:scaledNutrients(ingredient,quantity)};
 });
 const nutrients=Object.fromEntries(NUTRIENTS.map(([key])=>{const sum=ingredients.reduce((total,i)=>total+i.nutrients[key],0),factor=key==='kcal'?1:10;return[key,Math.round((sum+Number.EPSILON)*factor)/factor];}));
 return{...meal,ingredients,nutrients};
}
export function cleanQuantityChanges(changes){
 if(!Array.isArray(changes)||changes.length>320)throw new Error('Miktar değişikliklerini kontrol et.');
 const seen=new Set(),id=/^[a-z][a-z0-9_-]{0,39}$/;
 return changes.map(change=>{const key=change.meal_id+':'+change.ingredient_id,quantity=quantityNumber(change.quantity);if(typeof change.meal_id!=='string'||typeof change.ingredient_id!=='string'||!id.test(change.meal_id)||!id.test(change.ingredient_id)||seen.has(key)||quantity===null)throw new Error('Miktar 0–5000 arasında ve en fazla iki ondalık basamakla yazılmalı.');seen.add(key);return{meal_id:change.meal_id,ingredient_id:change.ingredient_id,quantity};});
}
