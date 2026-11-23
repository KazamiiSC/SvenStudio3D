/** SvenStudio 3D stable release: offline package and safe local server checks. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync,readdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
assert.equal(pkg.version,'1.0.0');
assert.equal(lock.version,pkg.version);
assert.equal(lock.packages[''].version,pkg.version);
assert.match(read('src/App.tsx'),/v1\.0\.0/);
assert.doesNotMatch(read('src/App.tsx'),/v1\.0\.0 RC1/);
assert.match(read('SvenStudio3D.bat'),/v1\.0\.0/);
for(const filename of [
  'SvenStudio3D.bat','SvenStudio3D.ico','CREAR_ACCESO_DIRECTO.bat',
  'index.html','public/SvenStudio3D.svg','public/SvenStudio3D_192.png',
  'public/SvenStudio3D_256.png','public/favicon.ico','src/components/ShadingPie.tsx',
  'src/engine/lightingPreview.ts','src/components/BspViewer.tsx',
  'src/components/Viewport.tsx','server/index.js','README.md','LEEME_ES.md',
  'GUIA_INSTALACION_ES.md','CONTROLES_ES.md','CHECKLIST_FINAL_ES.md',
  'ESTADO_LANZAMIENTO_ES.md','CHANGELOG.md','docs/history/CAMBIOS_0.9.5.md',
  'LICENCIAS_Y_DISTRIBUCION_ES.md','THIRD_PARTY_DEPENDENCIES.json',
  'scripts/create-shortcut.ps1','scripts/organizar-documentacion-rc1.bat'
])assert.ok(existsSync(path.join(root,filename)),`Missing stable file: ${filename}`);
assert.ok(!existsSync(path.join(root,'START_WINDOWS.bat')));
assert.match(read('SvenStudio3D.bat'),/Node\.js 22 or newer is required/);
assert.match(read('index.html'),/href="\/favicon\.ico"/);
const examples=readdirSync(path.join(root,'examples'));
const mapFiles=examples.filter(x=>x.endsWith('.map'));
const projects=examples.filter(x=>x.endsWith('.svenstudio.json'));
assert.ok(mapFiles.length>=9 && projects.length>=8);
for(const name of projects){
  const j=JSON.parse(read(`examples/${name}`));
  assert.ok(Array.isArray(j.objects)&&j.objects.length>0,`Empty example ${name}`);
}
for(const name of mapFiles){
  const s=read(`examples/${name}`);
  assert.ok(s.includes('worldspawn')&&s.length>100,`Invalid MAP ${name}`);
}
const i18n=read('src/i18n.ts');
for(const locale of ['en','es','ru','ko'])assert.ok(i18n.includes(`const ${locale}:Record<string,string>={`));
assert.ok(statSync(path.join(root,'SvenStudio3D.ico')).size>10000);
assert.equal(readdirSync(root).filter(x=>/^CAMBIOS_.*\.md$/.test(x)).length,0);
const licenses=JSON.parse(read('THIRD_PARTY_DEPENDENCIES.json'));
assert.ok(licenses.packages.length>200);
console.log(`PASS stable offline: version/branding, launcher, 4 locales, ${mapFiles.length} MAP + ${projects.length} JSON, dependency inventory`);
// HTTP checks intentionally cannot compile or read game files.
const endpoint='http://127.0.0.1:49177';
let child=null;
const health=async()=>{try{const r=await fetch(`${endpoint}/api/health`,{signal:AbortSignal.timeout(800)});return r.ok?await r.json():null;}catch{return null;}};
try{
 let status=await health();
 if(!status){
   child=spawn(process.execPath,['server/index.js'],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});
   let err='';child.stderr.on('data',b=>err+=String(b).slice(-500));
   for(let i=0;i<45;i++){status=await health();if(status)break;if(child.exitCode!==null)throw new Error(`Server terminated: ${err}`);await sleep(100);}
 }
 assert.ok(status?.ok,'Health endpoint unavailable');
 assert.deepEqual(status.stages,['CSG','BSP','VIS','RAD']);
 for(const [route,body] of [
   ['/api/compile',{mapName:'../bad',mapData:'invalid'}],
   ['/api/bsp/compiled',{mapName:'../bad',gameDir:'/'}],
   ['/api/svengine/fgd',{gameDir:'__invalid_directory_for_stable__'}]
 ]){
   const r=await fetch(`${endpoint}${route}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(3000)});
   assert.equal(r.status,400,`Expected safe 400 at ${route}`);
   const data=await r.json();assert.ok(typeof data.error==='string'&&data.error.length>3);
 }
 console.log('PASS stable API: health and safe error handling');
}finally{if(child){child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1200)]);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}}
