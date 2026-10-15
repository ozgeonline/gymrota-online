import {id,validateProgram,cleanDefinition,entryKey} from './domain.js';
const DEMO_KEY='gunluk-odak-demo-v1';
export function cleanProgram(p){const v=validateProgram(p);return{name:v.name,start_date:v.start_date,weeks:v.weeks,definition:cleanDefinition(v)};}
export class DemoStore{
 constructor(storage=localStorage){this.storage=storage;this.user={id:'demo-local',email:'Önizleme'};this.data={programs:[],entries:{},notes:{},nutrition:{},mealEntries:{}};const raw=storage.getItem(DEMO_KEY);if(raw){const value=JSON.parse(raw);if(!Array.isArray(value.programs))throw new Error('Önizleme kaydı okunamadı.');this.data={...this.data,...value};}this.mode='demo';}
 persist(){this.storage.setItem(DEMO_KEY,JSON.stringify(this.data));}
 async list(){return structuredClone(this.data.programs);}
 async save(p){const body=cleanProgram(p);const list=structuredClone(this.data.programs);let out;
  if(p.id){const index=list.findIndex(x=>x.id===p.id);if(index<0||list[index].version!==p.version)throw new Error('Program başka bir oturumda değişti. Sayfayı yenile.');if(this.hasLogs(p.id)&&(body.start_date!==list[index].start_date||body.weeks!==list[index].weeks))throw new Error('Takibi başlayan programın tarihini değiştirmek için yeni program oluştur.');out={...list[index],...body,version:p.version+1};list[index]=out;}
  else{out={...body,id:id(),user_id:this.user.id,version:1,created_at:new Date().toISOString()};list.unshift(out);}
  const prev=this.data.programs;this.data.programs=list;try{this.persist();}catch(err){this.data.programs=prev;throw err;}return structuredClone(out);
 }
 hasLogs(pid){return Object.keys(this.data.entries[pid]||{}).length>0||Object.keys(this.data.notes[pid]||{}).length>0||Object.keys(this.data.nutrition[pid]||{}).length>0;}
 async load(pid){return{logs:structuredClone(this.data.entries[pid]||{}),notes:structuredClone(this.data.notes[pid]||{}),nutrition:structuredClone(this.data.nutrition[pid]||{}),mealLogs:structuredClone(this.data.mealEntries[pid]||{})};}
 async check(pid,date,eid,value){const prev=structuredClone(this.data);(this.data.entries[pid]??={})[entryKey(date,eid)]=value;try{this.persist();}catch(err){this.data=prev;throw err;}}
 async note(pid,date,note){const prev=structuredClone(this.data);(this.data.notes[pid]??={})[date]=note;try{this.persist();}catch(err){this.data=prev;throw err;}}
 async checkMeal(pid,date,mid,value){if(!this.data.nutrition[pid]?.[date]?.meals.some(m=>m.id===mid))throw new Error('Bu öğün seçili tarihte bulunamadı.');const prev=structuredClone(this.data);(this.data.mealEntries[pid]??={})[entryKey(date,mid)]=value;try{this.persist();}catch(err){this.data=prev;throw err;}}
}
export class CloudStore{
 constructor(client,user){this.client=client;this.user=user;this.mode='cloud';}
 async list(){const {data,error}=await this.client.from('gym_programs').select('*').eq('user_id',this.user.id).order('created_at',{ascending:false});if(error)throw error;return data;}
 async save(p){const body={...cleanProgram(p),user_id:this.user.id};let q=this.client.from('gym_programs');q=p.id?q.update(body).eq('id',p.id).eq('user_id',this.user.id).eq('version',p.version):q.insert(body);const {data,error}=await q.select().single();if(error){if(error.code==='PGRST116')throw new Error('Program başka bir cihazda değişti. Kaydetmeden önce güncel halini yükle.');throw error;}return data;}
 async load(pid){const logs={},notes={},nutrition={},mealLogs={};for(const table of ['gym_entries','gym_notes','gym_nutrition_days','gym_meal_entries']){for(let offset=0;;offset+=500){let q=this.client.from(table).select('*').eq('program_id',pid).eq('user_id',this.user.id).order('session_date');if(table==='gym_entries')q=q.order('exercise_id');if(table==='gym_meal_entries')q=q.order('meal_id');const{data,error}=await q.range(offset,offset+499);if(error)throw error;for(const row of data){if(table==='gym_entries')logs[entryKey(row.session_date,row.exercise_id)]=row.completed;else if(table==='gym_notes')notes[row.session_date]=row.note;else if(table==='gym_nutrition_days')nutrition[row.session_date]=row;else mealLogs[entryKey(row.session_date,row.meal_id)]=row.completed;}if(data.length<500)break;}}return{logs,notes,nutrition,mealLogs};}
 async check(pid,date,eid,value){const{error}=await this.client.from('gym_entries').upsert({program_id:pid,user_id:this.user.id,session_date:date,exercise_id:eid,completed:value},{onConflict:'program_id,session_date,exercise_id'});if(error)throw error;}
 async note(pid,date,note){const{error}=await this.client.from('gym_notes').upsert({program_id:pid,user_id:this.user.id,session_date:date,note},{onConflict:'program_id,session_date'});if(error)throw error;}
 async checkMeal(pid,date,mid,value){const{error}=await this.client.from('gym_meal_entries').upsert({program_id:pid,user_id:this.user.id,session_date:date,meal_id:mid,completed:value},{onConflict:'program_id,session_date,meal_id'});if(error)throw error;}
}
