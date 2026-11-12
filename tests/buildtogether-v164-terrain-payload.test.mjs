import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {attachBuildTogether} from '../server/buildTogether.js';
const require=createRequire(import.meta.url);
function loadTs(){try{return require('typescript')}catch{return require(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}}
const ts=loadTs();
async function terrainModule(){
 const dir=await mkdtemp(join(tmpdir(),'svenstudio-terrain-wire-'));
 const source=await readFile(new URL('../src/engine/terrain.ts',import.meta.url),'utf8');
 const transformed=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replaceAll("from './types'","from './types.mjs'")
  .replaceAll("from './geometry'","from './geometry.mjs'")
  .replaceAll("from './modeling'","from './modeling.mjs'")
  .replaceAll("from './exportMap'","from './exportMap.mjs'");
 await Promise.all([
  writeFile(join(dir,'terrain.mjs'),transformed),
  writeFile(join(dir,'types.mjs'),`export const uid=()=>globalThis.crypto.randomUUID();`),
  writeFile(join(dir,'geometry.mjs'),`export const orientFaces=(vertices,faces)=>faces; export function createBrush(){throw Error('unneeded in test')}`),
  writeFile(join(dir,'modeling.mjs'),`export function rebuildConvexBrush(){throw Error('unneeded in test')}`),
  writeFile(join(dir,'exportMap.mjs'),`export const validateBrush=()=>[];`)
 ]);
 return {module:await import(pathToFileURL(join(dir,'terrain.mjs')).href),cleanup:()=>rm(dir,{recursive:true,force:true})};
}
function waitForType(ws,type,timeout=9000){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.removeEventListener('message',listener);reject(Error('Timed out: '+type))},timeout);
 function listener(event){let packet;try{packet=JSON.parse(event.data)}catch{return}if(packet.type!==type)return;clearTimeout(timer);ws.removeEventListener('message',listener);resolve(packet)}
 ws.addEventListener('message',listener);
});}
async function opened(ws){if(ws.readyState===WebSocket.OPEN)return;await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})})}
function appStub(){const handlers=new Map();return {post:(url,fn)=>handlers.set(url,fn),create(project){const output={};const res={set(){return this},status(code){output.status=code;return this},json(value){output.value=value;return this}};handlers.get('/api/buildtogether/create')({body:{project}},res);return output.value}}}
function terrainFixture(t){const draft={...t.defaultTerrain(),resolution:16,heights:Array(289).fill(0)};for(let k=0;k<289;k++)draft.heights[k]=Math.sin(k/8)*50;const brushes=t.createTerrainBrushes(draft);return {draft,brushes,record:t.terrainRecord(draft,brushes)};}
test('terrain provenance signatures shrink wire payload without losing edit detection or old-project compatibility',async()=>{
 const {module:t,cleanup}=await terrainModule();try{
  const {brushes,record}=terrainFixture(t);
  assert.equal(brushes.length,512);assert.equal(record.brushSignatures.length,512);
  assert.ok(record.brushSignatures.every(signature=>/^v2:[a-f0-9]{16}$/.test(signature)));
  const old=brushes.map(b=>JSON.stringify([b.position,b.rotation,b.scale,b.vertices,b.faces,b.entityId]));
  assert.ok(Buffer.byteLength(JSON.stringify(record.brushSignatures))<Buffer.byteLength(JSON.stringify(old))*.15,'compact signatures must substantially reduce repeated geometry');
  assert.equal(t.terrainBrushMatchesSignature(brushes[0],old[0]),true,'existing terrain can be edited with legacy metadata');
  assert.equal(t.terrainBrushMatchesSignature(brushes[0],record.brushSignatures[0]),true);
  const edited={...brushes[0],vertices:brushes[0].vertices.map((v,i)=>i===0?[v[0],v[1],v[2]+12]:v)};
  assert.equal(t.terrainBrushMatchesSignature(edited,record.brushSignatures[0]),false,'manual vertex edits remain protected');
  const packet={type:'change',base:0,ops:brushes.map(object=>({kind:'put',id:object.id,object})),metaPatch:{set:{terrainGroups:[record]},unset:[]}};
  assert.ok(Buffer.byteLength(JSON.stringify(packet))<1_500_000,'16x16 terrain should be one bounded atomic transaction');
 }finally{await cleanup()}
});
test('server applies and relays 512 brushes plus metadata atomically without disconnect, late joiner sees committed terrain',async()=>{
 const {module:t,cleanup}=await terrainModule();
 const app=appStub();const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 let host,guest,late;
 try{
  await new Promise(resolve=>service.server.listening?resolve():service.server.once('listening',resolve));
  const port=service.server.address().port;
  const project={version:1,name:'Large Terrain Test',objects:[],world:{classname:'worldspawn'},wadNames:[]};
  const {code,hostKey}=app.create(project);
  const url=`ws://127.0.0.1:${port}/buildtogether`;
  host=new WebSocket(url);await opened(host);const hostInit=waitForType(host,'snapshot');host.send(JSON.stringify({type:'join',protocol:3,code,hostKey,name:'Host'}));await hostInit;
  guest=new WebSocket(url);await opened(guest);const guestInit=waitForType(guest,'snapshot');guest.send(JSON.stringify({type:'join',protocol:3,code,name:'Guest'}));await guestInit;
  const {brushes,record}=terrainFixture(t);
  const hostUpdate=waitForType(host,'change'),guestUpdate=waitForType(guest,'change');
  guest.send(JSON.stringify({type:'change',base:0,ops:brushes.map(object=>({kind:'put',id:object.id,object})),metaPatch:{set:{terrainGroups:[record]},unset:[]}}));
  const [receivedHost,receivedGuest]=await Promise.all([hostUpdate,guestUpdate]);
  assert.equal(receivedHost.revision,1);assert.equal(receivedHost.ops.length,512);
  assert.equal(receivedGuest.ops.length,512);assert.equal(receivedHost.metaPatch.set.terrainGroups[0].brushIds.length,512);
  assert.equal(guest.readyState,WebSocket.OPEN);assert.equal(host.readyState,WebSocket.OPEN);
  late=new WebSocket(url);await opened(late);const snapshot=waitForType(late,'snapshot');late.send(JSON.stringify({type:'join',protocol:3,code,name:'Late joiner'}));
  const state=await snapshot;assert.equal(state.project.objects.length,512);assert.equal(state.project.terrainGroups.length,1);
  assert.equal(state.project.terrainGroups[0].brushSignatures.length,512);
 }finally{
  try{host?.close();guest?.close();late?.close()}catch{}
  await sleep(100);service.closeRoom();await new Promise(resolve=>service.server.close(resolve));await cleanup();
 }
});
