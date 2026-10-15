import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {DemoStore} from '../src/store.js';
import {weekFixture} from './helpers/week-specific.mjs';
import {mealFixture} from './helpers/nutrition.mjs';
test('Gym and nutrition share dates, retain notes, and persist independent meal ticks through reload',async()=>{
 const w=new Window({url:'https://preview.example/'});w.structuredClone=structuredClone;w.confirm=()=>true;
 try{
 const s=new DemoStore(w.localStorage),p=await s.save(weekFixture());
 s.data.nutrition[p.id]=Object.fromEntries(['2026-10-19','2026-10-20','2026-10-21','2026-10-26'].map(date=>[date,{session_date:date,meals:mealFixture(date),notes:'Et çiğ, bulgur pişmiş tartılır.'}]));
 s.data.nutrition[p.id]['2026-10-19'].meals[0].title='<img src=x onerror=alert(1)>';s.persist();
 const html=await readFile(new URL('../artifacts/GymRota_Online_Onizleme.html',import.meta.url),'utf8');w.document.write(html.replace(/<script>[\s\S]*?<\/script>/,''));w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 const q=selector=>{const e=w.document.querySelector(selector);assert.ok(e,'Missing '+selector);return e};
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
 const click=async selector=>{q(selector.startsWith('[')?selector:'[data-action="'+selector+'"]').click();await settle()};
 await click('demo');assert.equal(q('time').getAttribute('datetime'),'2026-10-19');assert.equal(q('#tab-gym').getAttribute('aria-selected'),'true');
 const note=q('[name=session-note]');note.value='Kaybolmaması gereken not';note.dispatchEvent(new w.Event('input',{bubbles:true}));
 await click('[data-tab=nutrition]');assert.equal(w.document.querySelectorAll('[data-meal-check]').length,4);assert.equal(q('time').getAttribute('datetime'),'2026-10-19');assert.equal(w.document.querySelectorAll('img').length,0);assert.match(q('.daily-nutrition-summary').textContent,/1\.060/);
 const meal=q('[data-meal-check=breakfast]');meal.checked=true;meal.dispatchEvent(new w.Event('change',{bubbles:true}));await settle();assert.match(q('.daily-heading').textContent,/1 \/ 4/);
 await click('[data-tab=gym]');assert.equal(q('[name=session-note]').value,'Kaybolmaması gereken not');assert.equal(q('progress').value,0);assert.equal(q('[data-check]').checked,false);await click('save-note');
 await click('[data-tab=nutrition]');await click('[data-action=track-day][data-index="1"]');assert.equal(q('time').getAttribute('datetime'),'2026-10-20');assert.equal(q('[data-meal-check=breakfast]').checked,false);assert.match(q('.meal-description').textContent,/100 g/);
 await click('[data-action=track-day][data-index="2"]');assert.equal(w.document.querySelectorAll('[data-meal-check]').length,4);await click('[data-tab=gym]');assert.match(q('#panel-gym').textContent,/toparlanmaya/);
 await click('[data-tab=nutrition]');await click('next-week');assert.equal(q('time').getAttribute('datetime'),'2026-10-26');assert.match(q('.meal-heading').textContent,/2026-10-26/);await click('prev-week');assert.equal(q('[data-meal-check=breakfast]').checked,true);
 q('#tab-nutrition').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));assert.equal(q('#tab-gym').getAttribute('aria-selected'),'true');assert.equal(w.document.activeElement.id,'tab-gym');
 await click('logout');assert.equal(w.document.querySelectorAll('.meal-card').length,0);await click('demo');await click('[data-tab=nutrition]');assert.equal(q('[data-meal-check=breakfast]').checked,true);
 await click('[data-action=track-day][data-index="3"]');assert.equal(w.document.querySelectorAll('[data-meal-check]').length,0);assert.match(q('#panel-nutrition').textContent,/henüz bir beslenme planın bulunmuyor/);
 }finally{await w.happyDOM.abort();w.close()}
});
