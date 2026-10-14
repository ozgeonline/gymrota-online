import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
test('Offline app flow: blank builder, suggestions/custom video, saved date ticks/notes and logout',async()=>{
 const w=new Window({url:'https://preview.example/'});w.confirm=()=>true;w.structuredClone=structuredClone;
 try{
 const html=await readFile(new URL('../artifacts/GymRota_Online_Onizleme.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 w.document.write(html.replace(/<script>[\s\S]*?<\/script>/,''));w.eval(script);
 const q=s=>{const el=w.document.querySelector(s);assert.ok(el,`Missing ${s}`);return el};
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
 const click=async selector=>{q(selector.startsWith('[')?selector:`[data-action="${selector}"]`).click();await settle()};
 const input=(selector,value,event='input')=>{const el=q(selector);el.value=value;el.dispatchEvent(new w.Event(event,{bubbles:true}))};
 await click('demo');assert.equal(q('[name="program-name"]').value,'');assert.equal(w.document.querySelectorAll('[data-action="toggle-day"][aria-pressed="true"]').length,0);
 input('[name="program-name"]','<img src=x onerror=alert(1)> Plan');input('[name="program-date"]','2026-10-19');
 await click('[data-action="toggle-day"][data-day="0"]');await click('next-step');
 await click('[data-action="add-suggestion"][data-suggestion="0"]');assert.equal(q('[data-field="name"]').value,'Squat');
 await click('add-video');input('[data-ex="1"][data-field="name"]','Video antrenmanım');input('[data-ex="1"][data-field="video"]','https://www.youtube.com/watch?v=5he1_JLnuSI');input('[data-ex="1"][data-field="seconds"]','1500');
 await click('next-step');await click('save-program');assert.equal(w.document.querySelectorAll('[data-check]').length,2);assert.equal(w.document.querySelectorAll('img').length,0);
 assert.match(q('a').href,/youtube/);assert.equal(q('progress').value,0);
 for(let i=0;i<2;i++){const el=w.document.querySelectorAll('[data-check]')[i];el.checked=true;el.dispatchEvent(new w.Event('change',{bubbles:true}));await settle();}
 assert.equal(q('progress').value,1);input('[name="session-note"]','4 kg ile tamamlandı');await click('save-note');
 await click('next-week');assert.equal(q('[data-check]').checked,false);assert.equal(q('[name="session-note"]').value,'');
 await click('prev-week');assert.equal(q('[data-check]').checked,true);assert.equal(q('[name="session-note"]').value,'4 kg ile tamamlandı');
 await click('edit-program');assert.equal(q('[name="program-date"]').disabled,true);await click('next-step');await click('[data-action="add-suggestion"][data-suggestion="1"]');assert.equal(w.document.querySelectorAll('.exercise-editor').length,3);await click('back-step');await click('cancel-builder');
 await click('logout');assert.equal(w.document.querySelectorAll('[data-check]').length,0);await click('demo');assert.equal(q('progress').value,1);assert.equal(q('[name="session-note"]').value,'4 kg ile tamamlandı');
 }finally{await w.happyDOM.abort();w.close()}
});
