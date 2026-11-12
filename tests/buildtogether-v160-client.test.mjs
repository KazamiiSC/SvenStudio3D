import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';
import {attachBuildTogether} from '../server/buildTogether.js';
const require=createRequire(import.meta.url);
// Prefer the project's TypeScript after npm install; allow a global toolchain
// in restricted offline verification environments.
let ts;try{ts=require('typescript')}catch{ts=require(join(dirname(dirname(process.execPath)),'lib/node_modules/typescript/lib/typescript.js'))}
const original={version:1,name:'v160_shared',objects:[{kind:'entity',id:'spawn1',name:'Start',classname:'info_player_start',position:[0,0,32],props:{}}],world:{classname:'worldspawn'},wadNames:[]};
const fakeZustand=`export function create(init){let state;const listeners=new Set;const hook=sel=>sel(state);hook.getState=()=>state;hook.setState=updater=>{const old=state;const patch=typeof updater==='function'?updater(old):updater;state={...old,...patch};for(const fn of [...listeners])fn(state,old);};hook.subscribe=fn=>{listeners.add(fn);return ()=>listeners.delete(fn)};state=init(hook.setState,hook.getState,hook.subscribe);return hook;}`;
const fakeStore=`import {create} from './zustand.mjs';export const useEditor=create(()=>({project:${JSON.stringify(original)},selected:null,selectedIds:[],history:[],future:[],appendLogs:()=>{}}));`;
async function waitFor(predicate,timeout=13000){const started=Date.now();while(!predicate()){if(Date.now()-started>timeout)throw Error('Timed out awaiting collaboration state');await sleep(25)}}
async function clientModule(folder,id){
 await writeFile(join(folder,`store${id}.mjs`),fakeStore);
 const source=await readFile(new URL('../src/engine/buildTogetherClient.ts',import.meta.url),'utf8');
 const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replace("from 'zustand'","from './zustand.mjs'").replace("from '../store'",`from './store${id}.mjs'`);
 await writeFile(join(folder,`client${id}.mjs`),transpiled);
 const client=await import(pathToFileURL(join(folder,`client${id}.mjs`)).href);
 const {useEditor}=await import(pathToFileURL(join(folder,`store${id}.mjs`)).href);
 return {client,useEditor};
}
function brush(i,offset=0){return {kind:'brush',id:'bt_hill_'+i,name:'Terrain',primitive:'box',position:[i*16,offset,0],rotation:[0,0,0],scale:[16,16,16],vertices:[],faces:[]};}
function roomServer(){const routes={};const app={post:(path,cb)=>routes[path]=cb};const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});return {routes,service};}
async function waitServer(service){await new Promise(ok=>service.server.listening?ok():service.server.once('listening',ok));return service.server.address().port;}
function createRoom(routes){let reply;routes['/api/buildtogether/create']({body:{project:original}},{set(){return this;},status(){return this;},json(v){reply=v;return this;}});return reply;}
async function snap(port,code){const ws=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);await new Promise(r=>ws.addEventListener('open',r,{once:true}));const result=new Promise((ok,no)=>{const t=setTimeout(()=>no(Error('snapshot timeout')),3000);ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.type==='snapshot'){clearTimeout(t);ok(m)}})});ws.send(JSON.stringify({type:'join',code,protocol:3,name:'Verifier'}));const data=await result;ws.close();return data;}

test('BuildTogether 3.0 actual clients: 512-brush terrain and concurrent cinematic/NPC/surface/architecture metadata survive both peers',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'sven-v160-test-'));
 const oldLocation=globalThis.location,oldStorage=globalThis.sessionStorage;
 globalThis.location={protocol:'http:'};const backups=new Map();globalThis.sessionStorage={getItem:key=>backups.get(key)||null,setItem:(key,value)=>backups.set(key,value)};
 const {routes,service}=roomServer();const port=await waitServer(service);const creds=createRoom(routes);
 let A,B;
 try{
  await writeFile(join(directory,'zustand.mjs'),fakeZustand);
  A=await clientModule(directory,'a');B=await clientModule(directory,'b');
  await A.client.joinBuildTogether(`127.0.0.1:${port}`,creds.code,'Host',{hostKey:creds.hostKey});
  await B.client.joinBuildTogether(`127.0.0.1:${port}`,creds.code,'Guest');
  const terrain=Array.from({length:512},(_,i)=>brush(i));
  A.useEditor.setState(s=>({project:{...s.project,objects:[...s.project.objects,...terrain],terrainGroups:[{id:'hill',brushIds:terrain.map(b=>b.id)}]}}));
  B.useEditor.setState(s=>({project:{...s.project,cinematicPreviewSpeeds:{corner1:350},customNpcs:[{id:'npc1',name:'Custom NPC'}],surfaceSounds:{METAL:'M'},graphPositions:{trigger1:[1,2]},architectureLayouts:[{id:'layout1',name:'Room'}]}}));
  await waitFor(()=>A.client.useBuildTogether.getState().revision>=2&&B.client.useBuildTogether.getState().revision>=2&&A.client.useBuildTogether.getState().pendingChanges===0&&B.client.useBuildTogether.getState().pendingChanges===0);
  for(const {useEditor,client} of [A,B]){
   const p=useEditor.getState().project;
   assert.equal(p.objects.length,513);
   assert.equal(p.terrainGroups[0].brushIds.length,512);
   assert.equal(p.cinematicPreviewSpeeds.corner1,350);
   assert.equal(p.customNpcs[0].id,'npc1');
   assert.equal(p.surfaceSounds.METAL,'M');
   assert.equal(p.graphPositions.trigger1[0],1);
   assert.equal(p.architectureLayouts[0].id,'layout1');
   assert.equal(client.useBuildTogether.getState().conflictCount,0);
  }
  const snapshot=await snap(port,creds.code);
  assert.equal(snapshot.project.objects.length,513);
  assert.equal(snapshot.project.terrainGroups[0].brushIds.length,512);
  assert.equal(snapshot.project.cinematicPreviewSpeeds.corner1,350);
  // Modify a different studio key while the other participant edits terrain geometry.
  A.useEditor.setState(s=>({project:{...s.project,objects:s.project.objects.map(o=>o.id==='bt_hill_0'?brush(0,16):o)}}));
  B.useEditor.setState(s=>({project:{...s.project,architectureAssemblies:[{id:'assembly_1',memberIds:['bt_hill_1']}]}}));
  await waitFor(()=>A.client.useBuildTogether.getState().revision>=4&&B.client.useBuildTogether.getState().revision>=4&&A.client.useBuildTogether.getState().pendingChanges===0&&B.client.useBuildTogether.getState().pendingChanges===0);
  assert.equal(A.useEditor.getState().project.architectureAssemblies[0].id,'assembly_1');
  assert.equal(B.useEditor.getState().project.objects.find(o=>o.id==='bt_hill_0').position[1],16);
 }finally{
  A?.client.leaveBuildTogether();B?.client.leaveBuildTogether();await sleep(100);service.closeRoom();await new Promise(ok=>service.server.close(ok));
  globalThis.location=oldLocation;globalThis.sessionStorage=oldStorage;await rm(directory,{recursive:true,force:true});
 }
});

test('BuildTogether 3.0 detects same-studio races, retains a recovery backup and respects server authority',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'sven-v160-conflict-'));
 const oldLocation=globalThis.location,oldStorage=globalThis.sessionStorage;
 globalThis.location={protocol:'http:'};const backups=new Map();globalThis.sessionStorage={getItem:key=>backups.get(key)||null,setItem:(key,value)=>backups.set(key,value)};
 const {routes,service}=roomServer();const port=await waitServer(service);const creds=createRoom(routes);
 let A,guest;
 try{
  await writeFile(join(directory,'zustand.mjs'),fakeZustand);
  A=await clientModule(directory,'a');await A.client.joinBuildTogether(`127.0.0.1:${port}`,creds.code,'Host',{hostKey:creds.hostKey});
  guest=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);
  await new Promise(ok=>guest.addEventListener('open',ok,{once:true}));
  const joined=new Promise(ok=>guest.addEventListener('message',e=>{if(JSON.parse(e.data).type==='snapshot')ok();},{once:true}));
  guest.send(JSON.stringify({type:'join',protocol:3,code:creds.code,name:'Guest'}));await joined;
  A.useEditor.setState(s=>({project:{...s.project,terrainGroups:[{id:'local_unsent_hill',brushIds:[]}]}}));
  guest.send(JSON.stringify({type:'change',base:0,ops:[],metaPatch:{set:{terrainGroups:[{id:'remote_hill',brushIds:[]}]},unset:[]}}));
  await waitFor(()=>A.client.useBuildTogether.getState().conflictCount>0);
  assert.equal(A.useEditor.getState().project.terrainGroups[0].id,'remote_hill');
  const backed=backups.get('svenstudio:buildtogether-disconnected-backup');
  assert.ok(backed,'a local conflict must create a recoverable copy');
  assert.equal(JSON.parse(backed).terrainGroups[0].id,'local_unsent_hill');
  assert.match(A.client.useBuildTogether.getState().lastConflict,/terrainGroups/);
  assert.equal(A.client.useBuildTogether.getState().hasRecoveryBackup,true);
 }finally{
  A?.client.leaveBuildTogether();guest?.close();await sleep(100);service.closeRoom();await new Promise(ok=>service.server.close(ok));
  globalThis.location=oldLocation;globalThis.sessionStorage=oldStorage;await rm(directory,{recursive:true,force:true});
 }
});
