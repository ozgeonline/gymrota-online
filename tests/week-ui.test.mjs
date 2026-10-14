import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {DemoStore} from '../src/store.js';
import {weekFixture} from './helpers/week-specific.mjs';
test('Week-specific tracker and editor keep each week separate through save and reload',async()=>{
 const w=new Window({url:'https://preview.example/'});w.structuredClone=structuredClone;w.confirm=()=>true;
 try{
 const p=weekFixture();p.definition.weekPlans[0].instructions.push('<img src=x onerror=alert(1)>');
 await new DemoStore(w.localStorage).save(p);
 const html=await readFile(new URL('../artifacts/GymRota_Online_Onizleme.html',import.meta.url),'utf8');
 w.document.write(html.replace(/<script>[\s\S]*?<\/script>/,''));w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 const q=s=>{const e=w.document.querySelector(s);assert.ok(e,`Missing ${s}`);return e};
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
 const click=async a=>{q('[data-action="'+a+'"]').click();await settle()};
 const input=(s,v,event='input')=>{const e=q(s);e.value=v;e.dispatchEvent(new w.Event(event,{bubbles:true}))};
 await click('demo');assert.equal(q('progress').max,16);assert.match(q('.week-guidance').textContent,/odak 1/);assert.equal(w.document.querySelectorAll('img').length,0);
 for(let i=0;i<2;i++){const e=w.document.querySelectorAll('[data-check]')[i];e.checked=true;e.dispatchEvent(new w.Event('change',{bubbles:true}));await settle()}
 assert.equal(q('progress').value,1);await click('next-week');assert.match(q('.week-guidance').textContent,/odak 2/);assert.equal(q('[data-check]').checked,false);assert.equal(q('a').href,'https://example.com/video-2');
 await click('edit-program');await click('next-step');input('[name="editor-week"]','2','change');assert.equal(q('[data-field="name"]').value,'Video bölümü 3');
 input('[data-field="name"]','Değişen bölüm');input('[data-field="description"]','Yeni uygulama notu');await click('next-step');await click('save-program');
 const stored=(await new DemoStore(w.localStorage).list())[0];assert.equal(stored.definition.weekPlans[2].days[0].exercises[0].name,'Değişen bölüm');assert.equal(stored.definition.weekPlans[1].days[0].exercises[0].name,'Video bölümü 2');assert.equal(stored.definition.weekPlans[2].days[0].exercises[0].description,'Yeni uygulama notu');assert.equal(q('progress').value,1);
 }finally{await w.happyDOM.abort();w.close()}
});
