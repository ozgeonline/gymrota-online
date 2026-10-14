export const DAY_NAMES=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
export const REGIONS=['Kalça–bacak','Sırt','Göğüs','Omuz–kol','Karın','Tüm vücut','Kardiyo','Özel'];
export const CATALOG={
 'Kalça–bacak':['Squat','Romanian deadlift','Glute bridge','Reverse lunge','Side lunge','Calf raise'],
 'Sırt':['Dumbbell row','Reverse fly','Bird dog'],
 'Göğüs':['Duvar şınavı','Eğimli şınav','Dumbbell floor press'],
 'Omuz–kol':['Shoulder press','Lateral raise','Biceps curl','Triceps extension'],
 'Karın':['Dead bug','Plank','Side plank','Crunch'],
 'Tüm vücut':['Squat','Dumbbell row','Duvar şınavı','Glute bridge','Dead bug'],
 'Kardiyo':['Kondisyon bisikleti','Yürüyüş','Eliptik bisiklet'], 'Özel':[]
};
export function id(){return crypto.randomUUID();}
export function today(){const p=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`;}
export function dateValid(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function plusDays(date,n){if(!dateValid(date))throw new Error('Geçerli başlangıç tarihi seç.');const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekday(date){return(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;}
export function dateLabel(date,long=false){return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:long?'long':'short',...(long?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
export function newExercise(name='',mode='reps'){return{id:id(),name,mode,sets:mode==='reps'?2:null,reps:mode==='reps'?10:null,seconds:mode==='time'?60:null,weight:null,rest:60,video:''};}
export function newProgram(){return{name:'',start_date:today(),weeks:4,definition:{days:[]}};}
export function safeVideo(value){if(!value)return '';try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;return u.href;}catch{return null;}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
function validateDays(days){
 if(!Array.isArray(days)||days.length<1||days.length>7)throw new Error('En az bir antrenman günü seç.');
 const daySet=new Set(),ids=new Set();
 for(const d of days){if(!d||!int(d.weekday,0,6)||daySet.has(d.weekday))throw new Error('Antrenman günlerini kontrol et.');daySet.add(d.weekday);
  if(typeof d.title!=='string'||!d.title.trim()||d.title.length>80)throw new Error(DAY_NAMES[d.weekday]+': günün odağını yaz.');
  if(!Array.isArray(d.exercises)||!d.exercises.length||d.exercises.length>30)throw new Error(DAY_NAMES[d.weekday]+': 1–30 çalışma ekle.');
  for(const e of d.exercises){if(!e||!uuid.test(e.id)||ids.has(e.id))throw new Error('Hareket kimlikleri benzersiz olmalı.');ids.add(e.id);
   if(typeof e.name!=='string'||!e.name.trim()||e.name.length>120)throw new Error(DAY_NAMES[d.weekday]+': hareket adını yaz.');
   if(!['reps','time','instruction'].includes(e.mode))throw new Error('Çalışma türünü seç.');
   if(e.mode==='reps'&&(!int(e.sets,1,20)||!int(e.reps,1,200)))throw new Error(e.name+': set 1–20, tekrar 1–200 olmalı.');
   if(e.mode==='time'&&!int(e.seconds,5,7200))throw new Error(e.name+': süre 5–7200 saniye olmalı.');
   if(e.mode==='instruction'&&(typeof e.dose!=='string'||!e.dose.trim()||e.dose.length>160))throw new Error(e.name+': çalışma açıklamasını yaz (en fazla 160 karakter).');
   if(e.description!==undefined&&(typeof e.description!=='string'||e.description.length>1000))throw new Error('Uygulama notu en fazla 1000 karakter olmalı.');
   if(e.weight!==null&&(!Number.isFinite(e.weight)||e.weight<0||e.weight>500))throw new Error('Ağırlık 0–500 kg arasında olmalı.');
   if(!int(e.rest,0,600))throw new Error('Dinlenme 0–600 saniye arasında olmalı.');
   if(typeof e.video!=='string'||e.video.length>2048||safeVideo(e.video)===null)throw new Error('Video için geçerli bir https:// bağlantısı gir.');
  }
 }
}
export function validateProgram(p){
 if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>80)throw new Error('Program adı 1–80 karakter olmalı.');
 if(!dateValid(p.start_date)||p.start_date<'2020-01-01'||p.start_date>'2100-12-31')throw new Error('2020–2100 arasında geçerli bir başlangıç tarihi seç.');
 if(!int(Number(p.weeks),1,12))throw new Error('Program süresi 1–12 hafta olmalı.');
 validateDays(p.definition?.days);
 const guidance=p.definition.guidance;if(guidance!==undefined&&(!Array.isArray(guidance)||guidance.length>10||guidance.some(x=>typeof x!=='string'||x.length>1000)))throw new Error('Program notlarını kontrol et.');
 if(p.definition.weekPlans!==undefined){const ws=p.definition.weekPlans;
  if(!Array.isArray(ws)||ws.length!==Number(p.weeks))throw new Error('Her hafta için ayrı bir plan bulunmalı.');
  for(const [i,w]of ws.entries()){
   if(!w||w.week!==i||typeof w.title!=='string'||w.title.length>80)throw new Error('Hafta bilgilerini kontrol et.');
   if(!Array.isArray(w.instructions)||w.instructions.length>10||w.instructions.some(x=>typeof x!=='string'||x.length>1000))throw new Error('Hafta notlarını kontrol et.');
   validateDays(w.days);
  }
 }
 return {...p,name:p.name.trim(),weeks:Number(p.weeks)};
}
export function weekPlan(p,w){return p.definition.weekPlans?.[w]||{days:p.definition.days,title:'',instructions:[]};}
export function schedule(p){return Array.from({length:p.weeks*7},(_,i)=>{const date=plusDays(p.start_date,i),week=Math.floor(i/7),plan=weekPlan(p,week);const d=plan.days.find(x=>x.weekday===weekday(date));return{date,week,weekday:weekday(date),title:d?.title||'Dinlenme & toparlanma',exercises:d?.exercises||[]};});}
export function entryKey(date,exerciseId){return date+':'+exerciseId;}
export function progress(p,logs){const list=schedule(p).filter(d=>d.exercises.length);return{total:list.length,done:list.filter(d=>d.exercises.every(e=>logs[entryKey(d.date,e.id)]===true)).length};}
export function exerciseDose(e){const base=e.mode==='instruction'?e.dose:e.mode==='reps'?`${e.sets} set × ${e.reps} tekrar`:e.seconds%60===0?`${e.seconds/60} dakika`:`${e.seconds} saniye`;return base+(e.weight!==null?` · ${e.weight} kg`:'')+(e.rest?` · ${e.rest} sn dinlenme`:'');}
function cleanDays(days){return days.map(d=>({weekday:d.weekday,title:d.title.trim(),exercises:d.exercises.map(e=>({...e,name:e.name.trim(),video:safeVideo(e.video)||'',...(e.dose!==undefined?{dose:e.dose.trim()}:{}),...(e.description!==undefined?{description:e.description.trim()}:{})}))})).sort((a,b)=>a.weekday-b.weekday);}
export function cleanDefinition(p){const ws=p.definition.weekPlans,g=p.definition.guidance?{guidance:p.definition.guidance.map(x=>x.trim())}:{};return ws?{...g,days:cleanDays(ws[0].days),weekPlans:ws.map(w=>({week:w.week,title:w.title.trim(),instructions:w.instructions.map(x=>x.trim()),days:cleanDays(w.days)}))}:{...g,days:cleanDays(p.definition.days)};}
export function defaultIndex(p){const days=schedule(p),t=today();const i=days.findIndex(d=>d.date===t);return i>=0?i:0;}
