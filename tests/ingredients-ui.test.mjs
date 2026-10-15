import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {DemoStore} from '../src/store.js';
import {weekFixture} from './helpers/week-specific.mjs';
import {ingredientMealFixture} from './helpers/nutrition.mjs';
test('Product rows recalculate live, retain focus, validate, save/reload and isolate dates',async()=>{
 const w=new Window({url:'https://preview.example/'});w.structuredClone=structuredClone;w.confirm=()=>true;
 try{
 const s=new DemoStore(w.localStorage),p=await s.save(weekFixture());s.data.nutrition[p.id]={'2026-10-19':{meals:ingredientMealFixture()},'2026-10-20':{meals:ingredientMealFixture()}};s.persist();
 const html=await readFile(new URL('../artifacts/GymRota_Online_Onizleme.html',import.meta.url),'utf8');w.document.write(html.replace(/<script>[\s\S]*?<\/script>/,''));w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 const q=s=>{const e=w.document.querySelector(s);assert.ok(e,'Missing '+s);return e},settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
 const click=async s=>{q(s.startsWith('[')?s:'[data-action="'+s+'"]').click();await settle()},input=(s,v)=>{const e=q(s);e.focus();e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));return e};
 const food='[data-quantity-meal=breakfast][data-quantity-ingredient=sample_food]',milk='[data-quantity-meal=breakfast][data-quantity-ingredient=sample_milk]',summary='.daily-nutrition-summary [data-nutrient-value=kcal]';
 await click('demo');await click('[data-tab=nutrition]');assert.equal(w.document.querySelectorAll('.quantity-input').length,8);assert.equal(q(summary).textContent,'1.072');assert.equal(q('[data-action=save-quantities]').disabled,true);
 const focused=input(food,'50');assert.equal(w.document.activeElement,focused);assert.equal(q('[data-ingredient-row=sample_food] [data-ingredient-nutrient=kcal]').textContent,'100,0');assert.equal(q('.meal-card[data-meal-id=breakfast] .meal-nutrients [data-nutrient-value=kcal]').textContent,'168');assert.equal(q(summary).textContent,'972');assert.equal(q('[data-action=save-quantities]').disabled,false);
 input(milk,'100');assert.equal(q(summary).textContent,'938');await click('[data-tab=gym]');assert.equal(q('progress').value,0);await click('[data-tab=nutrition]');assert.equal(q(food).value,'50');
 await click('save-quantities');assert.match(q('#quantity-status').textContent,/Miktarlar güncel/);const loaded=await new DemoStore(w.localStorage).load(p.id);assert.equal(loaded.ingredientLogs['2026-10-19:breakfast:sample_food'],50);
 input(food,'');assert.equal(q(food).getAttribute('aria-invalid'),'true');assert.equal(q('[data-action=save-quantities]').disabled,true);assert.equal(q(summary).textContent,'938');
 await click('[data-action=reset-quantity][data-meal=breakfast][data-ingredient=sample_food]');assert.equal(q(food).value,'100');assert.equal(q(summary).textContent,'1.038');
 w.confirm=()=>false;await click('[data-action=track-day][data-index="1"]');assert.equal(q('time').getAttribute('datetime'),'2026-10-19');assert.equal(q(food).value,'100');
 w.confirm=()=>true;await click('[data-action=track-day][data-index="1"]');assert.equal(q(food).value,'100');assert.equal(q(milk).value,'200');assert.equal(q(summary).textContent,'1.072');
 await click('[data-action=track-day][data-index="0"]');assert.equal(q(food).value,'50');assert.equal(q(milk).value,'100');
 input(food,'0');assert.equal(q('[data-ingredient-row=sample_food] [data-ingredient-nutrient=kcal]').textContent,'0,0');await click('save-quantities');await click('logout');assert.equal(w.document.querySelectorAll('.quantity-input').length,0);await click('demo');await click('[data-tab=nutrition]');assert.equal(q(food).value,'0');assert.equal(q(summary).textContent,'838');
 }finally{await w.happyDOM.abort();w.close()}
});
