// Run only against a chosen project with two disposable, admin-created test users.
// Credentials come from environment or ignored .env; never print them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {newExercise,newProgram} from '../src/domain.js';
import {CloudStore} from '../src/store.js';
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const publicConfig=JSON.parse(fs.readFileSync('config/public.json','utf8'));
process.env.SUPABASE_URL||=publicConfig.url;
process.env.SUPABASE_PUBLISHABLE_KEY||=publicConfig.key;
const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','TEST_A_EMAIL','TEST_A_PASSWORD','TEST_B_EMAIL','TEST_B_PASSWORD'];
for(const k of names)if(!process.env[k])throw new Error(`Missing ${k}`);
const clients=[0,1,2].map(()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
const [a,b,anon]=clients;let pa,pb,sa,sb;
try{
 for(const [client,letter] of [[a,'A'],[b,'B']]){const {error}=await client.auth.signInWithPassword({email:process.env[`TEST_${letter}_EMAIL`],password:process.env[`TEST_${letter}_PASSWORD`]});assert.equal(error,null,'Test account login failed');}
 const ua=(await a.auth.getUser()).data.user,ub=(await b.auth.getUser()).data.user;assert.notEqual(ua.id,ub.id,'Use two different test users');
 sa=new CloudStore(a,ua);sb=new CloudStore(b,ub);
 const make=()=>({...newProgram(),name:`Isolation check ${crypto.randomUUID()}`,start_date:'2026-10-19',weeks:1,definition:{days:[{weekday:0,title:'Test',exercises:[newExercise('Test exercise')]}]}});
 pa=await sa.save(make());pb=await sb.save(make());
 const eid=pa.definition.days[0].exercises[0].id;
 await sa.check(pa.id,pa.start_date,eid,true);await sa.note(pa.id,pa.start_date,'Test note');
 assert.equal((await sa.load(pa.id)).notes[pa.start_date],'Test note');
 for(const table of ['gym_programs','gym_entries','gym_notes']){
  const column=table==='gym_programs'?'id':'program_id';
  const res=await b.from(table).select('*').eq(column,pa.id);assert.equal(res.error,null);assert.equal(res.data.length,0,'Cross-account data leak');
  const guest=await anon.from(table).select('*').eq(column,pa.id);assert.ok(guest.error||guest.data.length===0,'Anonymous data leak');
 }
 const forged=await b.from('gym_notes').insert({program_id:pa.id,user_id:ub.id,session_date:pa.start_date,note:'cross-account'});assert.ok(forged.error,'Forged ownership was accepted');
 const changed=await b.from('gym_programs').update({name:'cross-account'}).eq('id',pa.id).select();assert.equal(changed.data?.length||0,0);
 const removed=await b.from('gym_programs').delete().eq('id',pa.id).select();assert.equal(removed.data?.length||0,0);
 assert.equal((await a.from('gym_programs').select('name').eq('id',pa.id).single()).data.name,pa.name);
 console.log('Live Supabase owner isolation passed.');
}finally{
 for(const [client,p] of [[a,pa],[b,pb]])if(p){const {error}=await client.from('gym_programs').delete().eq('id',p.id);if(error)console.error('Could not remove an isolation-test program. Remove its “Isolation check” record in the test account.');}
 for(const client of clients)await client.auth.signOut({scope:'local'});
}
