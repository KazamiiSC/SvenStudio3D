import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';
import {attachBuildTogether} from '../server/buildTogether.js';
const require=createRequire(import.meta.url);
let ts;try{ts=require('typescript')}catch{ts=require(join(dirname(dirname(process.execPath)),'lib/node_modules/typescript/lib/typescript.js'))}
const project={version:1,name:'resync',objects:[],world:{classname:'worldspawn'},wadNames:[]};
const fakeZustand=`export function create(init){let state;const listeners=new Set;const hook=select=>select(state);hook.getState=()=>state;hook.setState=p=>{const old=state;state={...old,...(typeof p==='function'?p(state):p)};for(const cb of [...listeners])cb(state,old)};hook.subscribe=cb=>{listeners.add(cb);return ()=>listeners.delete(cb)};state=init(hook.setState,hook.getState,hook.subscribe);return hook}`;
const fakeStore=`import {create} from './zustand.mjs';export const useEditor=create(()=>({project:${JSON.stringify(project)},selected:null,selectedIds:[],mode:'select',resourceView:'objects',history:[],future:[],appendLogs:()=>{}}))`;
const brush=i=>({kind:'brush',id:'terrain-'+i,name:'Terrain',primitive:'poly',position:[i*3,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[],faces:[]});
async function waitFor(check,timeout=13000){const start=Date.now();while(!check()){if(Date.now()-start>timeout)throw Error('Timeout waiting for session reconciliation');await sleep(20)}}
async function createClient(dir,name){
 await writeFile(join(dir,`store-${name}.mjs`),fakeStore);
 const source=await readFile(new URL('../src/engine/buildTogetherClient.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replace("from 'zustand'","from './zustand.mjs'").replace("from '../store'",`from './store-${name}.mjs'`);
 await writeFile(join(dir,`client-${name}.mjs`),js);
 const client=await import(pathToFileURL(join(dir,`client-${name}.mjs`)).href);
 const {useEditor}=await import(pathToFileURL(join(dir,`store-${name}.mjs`)).href);
 return {client,useEditor};
}
test('large terrain survives a lost acknowledgement and a concurrent guest edit; peer camera stays visible through short reconnect',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bt-v162-reconnect-'));
 const old={ws:globalThis.WebSocket,location:globalThis.location,storage:globalThis.sessionStorage};
 globalThis.location={protocol:'http:'};const backups=new Map();globalThis.sessionStorage={getItem:k=>backups.get(k)||null,setItem:(k,v)=>backups.set(k,v)};
 const sockets=[];
 globalThis.WebSocket=class CapturedSocket extends old.ws{constructor(url){super(url);sockets.push(this)}};
 const routes={},app={post:(route,handler)=>routes[route]=handler};
 const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 await new Promise(done=>service.server.listening?done():service.server.once('listening',done));
 const port=service.server.address().port;
 let response;routes['/api/buildtogether/create']({body:{project}},{set(){return this},status(){return this},json(data){response=data}});
 let a,b;
 try{
  await writeFile(join(dir,'zustand.mjs'),fakeZustand);
  a=await createClient(dir,'a');b=await createClient(dir,'b');
  await a.client.joinBuildTogether(`127.0.0.1:${port}`,response.code,'Host',{hostKey:response.hostKey});
  await b.client.joinBuildTogether(`127.0.0.1:${port}`,response.code,'Guest');
  const aId=a.client.useBuildTogether.getState().selfId;
  a.client.sendBuildTogetherCamera({projection:'perspective',position:[50,150,50],target:[0,0,0],up:[0,1,0],orthoHeight:800,fov:58,aspect:1.8});
  await waitFor(()=>Boolean(b.client.useBuildTogether.getState().cameras[aId]));
  const terrain=Array.from({length:512},(_,i)=>brush(i));
  a.useEditor.setState(s=>({project:{...s.project,objects:terrain,terrainGroups:[{id:'large-hill',brushIds:terrain.map(x=>x.id)}]}}));
  // Force a loss inside the terrain flush debounce, before its atomic send.
  // The previous 128-brush implementation left an observable multi-ack window.
  await sleep(12);
  // Close the exact original host socket during the terrain operation.
  sockets[0].close();
  await waitFor(()=>a.client.useBuildTogether.getState().status==='reconnecting');
  assert.ok(a.useEditor.getState().project.objects.length===512,'unconfirmed hill must remain visible during recovery');
  await sleep(55);
  assert.ok(b.client.useBuildTogether.getState().cameras[aId], 'remote camera pose must stay cached during temporary disconnect');
  assert.ok(b.client.useBuildTogether.getState().participants.some(p=>p.id===aId), 'remote camera participant should remain visible during the grace period');
  // The peer creates a separate map object while the host is disconnected.
  b.useEditor.setState(s=>({project:{...s.project,objects:[...s.project.objects,{...brush(999),id:'guest-wall'}]}}));
  await waitFor(()=>a.client.useBuildTogether.getState().status==='online',8000);
  await waitFor(()=>a.client.useBuildTogether.getState().pendingChanges===0&&a.useEditor.getState().project.objects.length===513&&b.useEditor.getState().project.objects.length===513,13000);
  for(const c of [a,b]){
   const p=c.useEditor.getState().project;
   assert.equal(p.objects.filter(o=>o.id.startsWith('terrain-')).length,512);
   assert.equal(p.terrainGroups?.[0]?.brushIds.length,512);
   assert.ok(p.objects.some(o=>o.id==='guest-wall'));
  }
  // A reconnecting peer should not make another user's camera marker vanish.
  const bSocket=sockets.find(s=>s!==sockets[0]&&s.readyState===old.ws.OPEN);
  if(bSocket){
   // We already have a cached host camera and must not lose it on presence updates.
   assert.ok(b.client.useBuildTogether.getState().cameras[aId]);
  }
 }finally{
  a?.client.leaveBuildTogether();b?.client.leaveBuildTogether();await sleep(100);
  service.closeRoom();await new Promise(done=>service.server.close(done));
  globalThis.WebSocket=old.ws;globalThis.location=old.location;globalThis.sessionStorage=old.storage;
  await rm(dir,{recursive:true,force:true});
 }
});
