export function mealFixture(title='Örnek öğün'){
 return ['breakfast','snack-one','snack-two','dinner'].map((id,i)=>({id,label:['Kahvaltı','Ara öğün 1','Ara öğün 2','Akşam'][i],title:title+' '+(i+1),description:'Örnek porsiyon: 100 g ürün.',nutrients:{kcal:250+i*10,fat:8.5,carb:25.2,protein:18.3,sugar:6.1}}));
}
export function ingredientMealFixture(){
 return mealFixture().map(meal=>({...meal,nutrients:{kcal:268,fat:4.2,carb:29.9,protein:21.7,sugar:13.2},ingredients:[{id:'sample_food',name:'Örnek ürün',unit:'g',quantity:100,per100:{kcal:200,fat:4,carb:20,protein:15,sugar:3}},{id:'sample_milk',name:'Örnek süt',unit:'ml',quantity:200,per100:{kcal:34,fat:0.08,carb:4.96,protein:3.37,sugar:5.09}}]}));
}
