export function mealFixture(title='Örnek öğün'){
 return ['breakfast','snack-one','snack-two','dinner'].map((id,i)=>({id,label:['Kahvaltı','Ara öğün 1','Ara öğün 2','Akşam'][i],title:title+' '+(i+1),description:'Örnek porsiyon: 100 g ürün.',nutrients:{kcal:250+i*10,fat:8.5,carb:25.2,protein:18.3,sugar:6.1}}));
}
