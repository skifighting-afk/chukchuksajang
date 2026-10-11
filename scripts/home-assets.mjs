import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir,access,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import path from 'node:path';import {pathToFileURL} from 'node:url';
const manifestName='home-assets.json';
const hash=data=>createHash('sha256').update(data).digest('hex');
const allowed=/^home\/(?:home-[a-f0-9]{16}\.css|v-[a-f0-9]{16}\/(?:site|lib|app)\/[a-z0-9-]+\.js)$/;
function validate(m){
 assert.ok(Array.isArray(m.releases)&&m.releases.length>0&&m.releases.length<=3,'valid releases');
 for(const r of m.releases){assert.match(r.id,/^[a-f0-9]{16}$/);assert.ok(r.files&&Object.keys(r.files).length>0,'release files required');
  for(const [name,digest] of Object.entries(r.files)){assert.ok(allowed.test(name)&&name.includes(r.id),'Invalid asset path');assert.match(digest,/^[a-f0-9]{64}$/)}
 }
 return m;
}
export async function recordHomeRelease(dir){
 const html=await readFile(path.join(dir,'index.html'),'utf8'),id=html.match(/home\/v-([a-f0-9]{16})\/site\/home\.js/)?.[1];
 assert.ok(id,'versioned homepage entry required');const files={};
 const names=['home/home-'+id+'.css'];
 for(const folder of ['site','lib','app']){
  const parent='home/v-'+id+'/'+folder;
  let entries=[];try{entries=await readdir(path.join(dir,parent))}catch(e){if(e.code!=='ENOENT')throw e}
  for(const name of entries)if(allowed.test(parent+'/'+name))names.push(parent+'/'+name);
 }
 for(const name of names)files[name]=hash(await readFile(path.join(dir,name)));
 assert.ok(files['home/v-'+id+'/site/home.js'],'homepage entry exists');
 await writeFile(path.join(dir,manifestName),JSON.stringify(validate({releases:[{id,files}]}),null,2)+'\n');return id;
}
async function manifest(dir){try{return validate(JSON.parse(await readFile(path.join(dir,manifestName),'utf8')))}catch(e){if(e.code!=='ENOENT')throw e;await recordHomeRelease(dir);return manifest(dir)}}
export async function retainHomeAssets(previous,current){
 const old=await manifest(previous),now=await manifest(current),releases=[now.releases[0],...old.releases.filter(r=>r.id!==now.releases[0].id)].slice(0,3);
 for(const r of releases.slice(1))for(const [name,digest] of Object.entries(r.files)){
  const src=path.join(previous,name),dest=path.join(current,name);assert.equal(hash(await readFile(src)),digest,'previous asset integrity: '+name);
  let exists=true;try{await access(dest)}catch(e){if(e.code!=='ENOENT')throw e;exists=false}
  if(exists)assert.equal(hash(await readFile(dest)),digest,'asset collision: '+name);else{await mkdir(path.dirname(dest),{recursive:true});await copyFile(src,dest)}
 }
 await writeFile(path.join(current,manifestName),JSON.stringify({releases},null,2)+'\n');console.log('Homepage generations: '+releases.map(r=>r.id).join(', '));
}
export async function checkPublicHomeAssets(base,expected,request=fetch){
 const root=base.replace(/\/$/,''),r=await request(root+'/'+manifestName+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,'public manifest exists');
 const m=validate(await r.json());assert.equal(m.releases[0].id,expected,'published version matches build');
 const files=Object.assign({},...m.releases.map(r=>r.files)),pending=Object.entries(files);
 await Promise.all(Array.from({length:Math.min(6,pending.length)},async()=>{while(pending.length){const [name,digest]=pending.shift();const r=await request(root+'/'+name,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,name+' available');assert.match(r.headers.get('content-type')||'',name.endsWith('.css')?/text\/css/:/(?:javascript|ecmascript)/,name+' cannot be HTML fallback');assert.equal(hash(Buffer.from(await r.arrayBuffer())),digest,'public asset integrity: '+name)}}));
 return {generations:m.releases.length,files:Object.keys(files).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [mode,a,b]=process.argv.slice(2);
 if(mode==='record')console.log(await recordHomeRelease(a));
 else if(mode==='retain')await retainHomeAssets(a,b);
 else if(mode==='verify'){
  let last;for(let i=0;i<40;i++){try{const result=await checkPublicHomeAssets(a,b);console.log('PASS: public homepage assets '+JSON.stringify(result));last=null;break}catch(e){last=e;if(i<39)await new Promise(r=>setTimeout(r,15000))}}
  if(last)throw last;
 }else throw Error('Usage: home-assets.mjs record DIR | retain PREVIOUS CURRENT | verify URL VERSION');
}
