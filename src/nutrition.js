export const NUTRIENTS=[['kcal','Enerji','kcal'],['protein','Protein','g'],['carb','Karbonhidrat','g'],['fat','Yağ','g'],['sugar','Şeker','g']];
export function mealTotals(meals=[]){return Object.fromEntries(NUTRIENTS.map(([key])=>[key,Math.round(meals.reduce((sum,meal)=>sum+Number(meal.nutrients?.[key]||0),0)*10)/10]));}
export function nutrientText(value,key){return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:key==='kcal'?0:1,maximumFractionDigits:key==='kcal'?0:1}).format(value);}
export function mealProgress(day,date,logs){const meals=day?.meals||[];return{done:meals.filter(m=>logs[date+':'+m.id]===true).length,total:meals.length};}
