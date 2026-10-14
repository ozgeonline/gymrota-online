import {newProgram,newExercise} from '../../src/domain.js';
export function weekFixture(){
 const weekPlans=Array.from({length:4},(_,week)=>({week,title:'Haftalık odak '+(week+1),instructions:['Bu haftanın uygulama notu '+(week+1)],days:[0,1,3,5].map(weekday=>({weekday,title:'Çalışma günü',exercises:[{...newExercise('Video bölümü '+(week+1),'instruction'),dose:'İlgili bölümü uygula',description:'Hareket açıklaması '+(week+1),rest:0,video:`https://example.com/video-${week+1}`},{...newExercise('Süreli çalışma','time'),seconds:600+week*300,rest:0}]}))}));
 return {...newProgram(),name:'Haftalara göre plan',start_date:'2026-10-19',weeks:4,definition:{days:structuredClone(weekPlans[0].days),weekPlans}};
}
