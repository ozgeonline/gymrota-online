export const NUTRIENTS=[['kcal','Enerji','kcal'],['protein','Protein','g'],['carb','Karbonhidrat','g'],['fat','Yağ','g'],['sugar','Şeker','g']];
export function mealTotals(meals=[]){return Object.fromEntries(NUTRIENTS.map(([key])=>[key,Math.round(meals.reduce((sum,meal)=>sum+Number(meal.nutrients?.[key]||0),0)*10)/10]));}
export function nutrientText(value,key,digits=key==='kcal'?0:1){return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);}
export function mealProgress(day,date,logs){const meals=day?.meals||[];return{done:meals.filter(m=>logs[date+':'+m.id]===true).length,total:meals.length};}
export function quantityKey(date,mealId,ingredientId){return date+':'+mealId+':'+ingredientId;}
export function quantityNumber(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(String(value).replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=5000&&Math.abs(n*100-Math.round(n*100))<0.000001?n:null;}
export function quantityText(value){return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(value);}
// Household measures are approximate edible weights. Saved quantities keep
// their existing g/ml basis, including entries made before these controls.
export const SERVING_MEASURES={
 egg:{unit:'adet',grams:50,caption:'1 yumurta ≈50 g; kabuksuz ağırlık.'},
 tomato:{unit:'adet',grams:125,caption:'1 orta boy domates ≈125 g.'},
 cucumber:{unit:'adet',grams:100,caption:'1 küçük salatalık ≈100 g.'},
 apple:{unit:'adet',grams:150,caption:'1 küçük elma ≈150 g; yenebilir kısım.'},
 banana:{unit:'adet',grams:100,caption:'1 küçük muz ≈100 g; kabuksuz ağırlık.'},
 walnut:{unit:'adet',grams:5,caption:'1 tam ceviz içi (2 yarım) ≈5 g.'},
 almond:{unit:'adet',grams:1.2,caption:'1 badem içi ≈1,2 g.'},
 carrot:{unit:'adet',grams:50,caption:'1 küçük havuç ≈50 g.'},
 avocado:{unit:'adet',grams:200,caption:'1 avokado ≈200 g; kabuk ve çekirdek hariç.'},
 honey:{unit:'tatlı kaşığı',grams:10,caption:'Hesap ölçüsü: 1 tatlı kaşığı bal ≈10 g.'},
 corn_boiled:{unit:'koçan',grams:100,caption:'1 orta koçanın yenebilir taneleri ≈100 g.',name:'Haşlanmış mısır'},
 lemon:{unit:'adet',grams:50,caption:'1 limondan sıkılan su ≈50 g.'},
 onion:{unit:'adet',grams:100,caption:'1 soğan ≈100 g; ayıklanmış ağırlık.'}
};
export function servingMeasure(ingredient){return ingredient.unit==='g'&&Object.hasOwn(SERVING_MEASURES,ingredient.id)?SERVING_MEASURES[ingredient.id]:{unit:ingredient.unit,grams:1,caption:''};}
export function servingQuantity(ingredient,quantity){return Math.round((Number(quantity)/servingMeasure(ingredient).grams+Number.EPSILON)*100)/100;}
export function baseQuantityFromInput(ingredient,value,reference){
 const count=quantityNumber(value);if(count===null)return null;
 if(reference!==undefined&&count===servingQuantity(ingredient,reference))return Number(reference);
 const amount=Math.round((count*servingMeasure(ingredient).grams+Number.EPSILON)*100)/100;
 return quantityNumber(amount);
}
export function maximumServingQuantity(ingredient){return Math.floor(5000/servingMeasure(ingredient).grams*100)/100;}
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
