import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
const cwd=process.cwd();
try{process.loadEnvFile(path.join(cwd,'.env'));}catch(err){if(err.code!=='ENOENT')throw err;}
let publicConfig={};
try{publicConfig=JSON.parse(await fs.readFile('config/public.json','utf8'));}catch(err){if(err.code!=='ENOENT')throw err;}
const envUrl=process.env.SUPABASE_URL||'',envKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';
if(!!envUrl!==!!envKey)throw new Error('Both Supabase environment overrides must be supplied together.');
const url=envUrl||publicConfig.url||'',key=envKey||publicConfig.key||'';
if(process.env.REQUIRE_SUPABASE_CONFIG==='true'&&(!url||!key))throw new Error('Supabase public configuration is required for publication.');
if(!!url!==!!key)throw new Error('SUPABASE_URL ve SUPABASE_PUBLISHABLE_KEY birlikte tanımlanmalı.');
if(url&&!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))throw new Error('Geçerli https://PROJECT.supabase.co adresi gerekli.');
if(key){let allowed=key.startsWith('sb_publishable_');if(key.startsWith('eyJ')){try{allowed=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{allowed=false;}}if(!allowed)throw new Error('Yalnızca publishable veya anon anahtarı kullanılabilir. Secret/service_role anahtarı yasak.');}
const config={url,key,enableReset:process.env.ENABLE_PASSWORD_RESET===undefined?publicConfig.enableReset===true:process.env.ENABLE_PASSWORD_RESET==='true'};
await fs.mkdir('dist',{recursive:true});
const options={entryPoints:['src/app.js'],bundle:true,format:'iife',platform:'browser',target:['es2022'],minify:true,legalComments:'eof',define:{__CONFIG__:JSON.stringify(config),__OFFLINE_PREVIEW__:'false'}};
await build({...options,outfile:'dist/app.js'});
const html=await fs.readFile('src/index.html','utf8'),css=await fs.readFile('src/styles.css','utf8');
await fs.writeFile('dist/.nojekyll','');await fs.writeFile('dist/index.html',html);await fs.writeFile('dist/styles.css',css);
const preview=await build({...options,write:false,define:{__CONFIG__:JSON.stringify({url:'',key:'',enableReset:false}),__OFFLINE_PREVIEW__:'true'}});
const code=preview.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
await fs.mkdir('artifacts',{recursive:true});
await fs.writeFile('artifacts/GymRota_Online_Onizleme.html',html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'').replace('<link rel="stylesheet" href="./styles.css">',()=>'<style>'+css+'</style>').replace('<script src="./app.js" defer></script>',()=>'<script>'+code+'</script>'));
console.log('Build complete: dist/ + artifacts/GymRota_Online_Onizleme.html. '+(url?'Supabase public configuration included.':'Live login awaits Supabase project configuration.'));
