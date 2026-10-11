import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import {recordHomeRelease,retainHomeAssets,checkPublicHomeAssets} from './home-assets.mjs';
const root=await mkdtemp(path.join(tmpdir(),'chuk-home-assets-'));
async function release(c){const id=c.repeat(16),dir=path.join(root,c);await mkdir(path.join(dir,'home/v-'+id+'/site'),{recursive:true});await writeFile(path.join(dir,'index.html'),'<script type="module" src="/home/v-'+id+'/site/home.js"></script>');await writeFile(path.join(dir,'home/v-'+id+'/site/home.js'),'export const version="'+c+'"');await writeFile(path.join(dir,'home/home-'+id+'.css'),'body{color:'+c+'}');await recordHomeRelease(dir);return dir}
try{
 const a=await release('a'),b=await release('b'),c=await release('c'),d=await release('d');
 await retainHomeAssets(a,b);await retainHomeAssets(b,c);await retainHomeAssets(c,d);
 const manifest=JSON.parse(await readFile(path.join(d,'home-assets.json'),'utf8'));
 assert.deepEqual(manifest.releases.map(r=>r.id),['d','c','b'].map(c=>c.repeat(16)));
 await access(path.join(d,'home/v-'+('b'.repeat(16))+'/site/home.js'));await assert.rejects(access(path.join(d,'home/v-'+('a'.repeat(16))+'/site/home.js')));
 assert((await readFile(path.join(d,'index.html'),'utf8')).includes('v-'+('d'.repeat(16))),'current HTML preserved');
 const request=async url=>url.includes('home-assets.json')?new Response(JSON.stringify(manifest)):new Response(await readFile(path.join(d,new URL(url).pathname.slice(1))),{headers:{'content-type':url.endsWith('.css')?'text/css':'application/javascript'}});
 assert.equal((await checkPublicHomeAssets('https://test.invalid','d'.repeat(16),request)).generations,3);
 await assert.rejects(checkPublicHomeAssets('https://test.invalid','c'.repeat(16),request),/version/);
 await assert.rejects(checkPublicHomeAssets('https://test.invalid','d'.repeat(16),async url=>url.includes('home-assets.json')?request(url):new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}})),/HTML fallback/);
 await rm(path.join(a,'home-assets.json'));await retainHomeAssets(a,b);await access(path.join(b,'home/v-'+('a'.repeat(16))+'/site/home.js'));
 await writeFile(path.join(b,'home/v-'+('b'.repeat(16))+'/site/home.js'),'tampered');await assert.rejects(retainHomeAssets(b,c),/integrity/);
 const unsafe=JSON.parse(await readFile(path.join(b,'home-assets.json'),'utf8'));unsafe.releases[0].files['../private.js']='a'.repeat(64);await writeFile(path.join(b,'home-assets.json'),JSON.stringify(unsafe));await assert.rejects(retainHomeAssets(b,c),/asset path/);
 console.log('PASS: homepage three generations, legacy bootstrap, public HTTP/MIME/integrity and version/path boundaries.');
}finally{await rm(root,{recursive:true,force:true})}
