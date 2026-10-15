import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {DemoStore} from '../src/store.js';
import {SERVING_MEASURES} from '../src/nutrition.js';
import {weekFixture} from './helpers/week-specific.mjs';
import {mealFixture} from './helpers/nutrition.mjs';
test('Serving inputs keep historical weights, save converted amounts and provide a page-top arrow',async()=>{
 const w=new Window({url:'https://preview.example/'});w.structuredClone=structuredClone;w.confirm=()=>true;let scrollRequest;
 try{
 const s=new DemoStore(w.localStorage),p=await s.save(weekFixture()),meals=mealFixture();
 meals[0].ingredients=Object.entries(SERVING_MEASURES).map(([id,measure])=>({id,name:id,unit:'g',quantity:measure.grams,per100:{kcal:200,fat:4,carb:20,protein:15,sugar:3}}));
 meals[0].ingredients.find(i=>i.id==='egg').quantity=100;
 s.data.nutrition[p.id]={'2026-10-19':{meals},'2026-10-20':{meals:structuredClone(meals)}};
 s.data.ingredientEntries[p.id]={'2026-10-19:breakfast:egg':50};s.persist();
 const html=await readFile(new URL('../artifacts/GymRota_Online_Onizleme.html',import.meta.url),'utf8');w.document.write(html.replace(/<script>[\s\S]*?<\/script>/,''));w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 const q=selector=>{const e=w.document.querySelector(selector);assert.ok(e,'Missing '+selector);return e},settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
 const click=async selector=>{q(selector.startsWith('[')||selector.startsWith('#')?selector:'[data-action="'+selector+'"]').click();await settle()};
 const input=(id,value)=>{const e=q('[data-quantity-ingredient="'+id+'"]');e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));return e};
 await click('demo');await click('[data-tab=nutrition]');assert.equal(q('[data-quantity-ingredient=egg]').value,'1');assert.match(q('[data-ingredient-row=egg] .serving-equivalent').textContent,/50 g/);
 for(const [id,measure]of Object.entries(SERVING_MEASURES))assert.equal(q('[data-ingredient-row="'+id+'"] .serving-unit').textContent,measure.unit);
 input('egg','2');input('honey','2');input('corn_boiled','1.5');input('lemon','0.5');input('onion','0.5');
 assert.equal(q('[data-ingredient-row=honey] [data-ingredient-nutrient=kcal]').textContent,'40,0');assert.match(q('[data-ingredient-row=corn_boiled] .serving-equivalent').textContent,/150 g/);
 await click('save-quantities');const loaded=await new DemoStore(w.localStorage).load(p.id);
 for(const [id,value]of Object.entries({egg:100,honey:20,corn_boiled:150,lemon:25,onion:50}))assert.equal(loaded.ingredientLogs['2026-10-19:breakfast:'+id],value);
 await click('[data-tab=gym]');await click('[data-tab=nutrition]');assert.equal(q('[data-quantity-ingredient=egg]').value,'2');assert.equal(q('[data-quantity-ingredient=honey]').value,'2');
 await click('[data-action=track-day][data-index="1"]');assert.equal(q('[data-quantity-ingredient=honey]').value,'1');await click('[data-action=track-day][data-index="0"]');
 input('egg','-1');assert.equal(q('[data-action=save-quantities]').disabled,true);await click('[data-action=reset-quantity][data-meal=breakfast][data-ingredient=egg]');assert.equal(q('[data-quantity-ingredient=egg]').value,'2');assert.equal(q('[data-action=save-quantities]').disabled,true);assert.equal(q('[data-action=reset-quantity][data-meal=breakfast][data-ingredient=egg]').disabled,true);
 assert.equal(q('#back-to-top').hidden,true);Object.defineProperty(w,'scrollY',{value:800,writable:true,configurable:true});w.dispatchEvent(new w.Event('scroll'));assert.equal(q('#back-to-top').hidden,false);assert.equal(w.document.body.classList.contains('show-back-to-top'),true);
 w.scrollTo=options=>{scrollRequest=options;w.scrollY=0;w.dispatchEvent(new w.Event('scroll'))};await click('#back-to-top');assert.equal(scrollRequest.top,0);assert.equal(scrollRequest.behavior,'smooth');assert.equal(q('#back-to-top').hidden,true);assert.equal(q('time').getAttribute('datetime'),'2026-10-19');
 w.scrollY=800;w.dispatchEvent(new w.Event('scroll'));w.matchMedia=()=>({matches:true});await click('#back-to-top');assert.equal(scrollRequest.behavior,'auto');
 }finally{await w.happyDOM.abort();w.close()}
});
