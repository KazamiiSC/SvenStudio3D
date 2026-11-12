import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';
import {attachBuildTogether,Peer} from '../server/buildTogether.js';
const require=createRequire(import.meta.url);let ts;
try{ts=require('typescript')}catch{ts=require(join(dirname(dirname(process.execPath)),'lib/node_modules/typescript/lib/typescript.js'))}
const project={version:1,name:'stress',objects:[],world:{classname:'worldspawn'},wadNames:[]};
const zustand=`export function create(init){let state;const listeners=new Set;const hook=select=>select(state);hook.getState=()=>state;hook.setState=p=>{const old=state;state={...old,...(typeof p==='function'?p(state):p)};for(const cb of [...listeners])cb(state,old)};hook.subscribe=cb=>{listeners.add(cb);return ()=>listeners.delete(cb)};state=init(hook.setState,hook.getState,hook.subscribe);return hook}`;
const store=`import {create} from './zustand.mjs';export const useEditor=create(()=>({project:${JSON.stringify(project)},selected:null,selectedIds:[],mode:'select',resourceView:'objects',history:[],future:[],appendLogs:()=>{}}))`;
async function clientAt(dir,id){
 await writeFile(join(dir,`store-${id}.mjs`),store);
 const source=await readFile(new URL('../src/engine/buildTogetherClient.ts',import.meta.url),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'zustand'","from './zustand.mjs'").replace("from '../store'",`from './store-${id}.mjs'`);
 await writeFile(join(dir,`client-${id}.mjs`),output);
 const client=await import(pathToFileURL(join(dir,`client-${id}.mjs`)).href);
 const {useEditor}=await import(pathToFileURL(join(dir,`store-${id}.mjs`)).href);return {client,useEditor};
}
const brick=(i)=>({id:`terr-${i}`,kind:'brush',primitive:'poly',name:`Triangular terrain ${i}`,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'Terrain',group:'Terrain 1',vertices:[[i,0,10],[i+32,0,0],[i,32,20],[i,0,-96],[i+32,0,-96],[i,32,-96]],faces:[[0,1,2],[5,4,3],[0,3,4,1],[1,4,5,2],[2,5,3,0]].map(indices=>({indices,texture:'SV_BRICK01'}))});
async function until(pred,ms=20000){const start=Date.now();while(!pred()){if(Date.now()-start>ms)throw Error('Sync timed out');await sleep(25)}}
test('two live BuildTogether clients keep a full 512-brush terrain with 70 history checkpoints, without reconnecting or dropping remote edits',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bt164-real-client-'));const old={location:globalThis.location,storage:globalThis.sessionStorage};
 globalThis.location={protocol:'http:'};const backups=new Map();globalThis.sessionStorage={getItem:k=>backups.get(k)||null,setItem:(k,v)=>backups.set(k,v)};
 const route={},app={post:(path,fn)=>route[path]=fn};const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 await new Promise(done=>service.server.listening?done():service.server.once('listening',done));
 let response;route['/api/buildtogether/create']({body:{project}},{set(){return this},status(){return this},json(data){response=data}});
 let a,b;
 try{
  await writeFile(join(dir,'zustand.mjs'),zustand);
  a=await clientAt(dir,'a');b=await clientAt(dir,'b');const endpoint=`127.0.0.1:${service.server.address().port}`;
  await a.client.joinBuildTogether(endpoint,response.code,'Host',{hostKey:response.hostKey});
  await b.client.joinBuildTogether(endpoint,response.code,'Guest');
  const state=project;const history=Array.from({length:70},()=>({...state,objects:[]}));
  b.useEditor.setState({history});
  const brushes=Array.from({length:512},(_,i)=>brick(i));
  const group={id:'terrain-1',name:'Terrain 1',origin:[0,0,0],width:512,depth:512,resolution:16,heights:Array(289).fill(0),texture:'SV_BRICK01',baseDepth:96,brushIds:brushes.map(o=>o.id),brushSignatures:brushes.map(()=> 'v2:123456789abcdef0')};
  a.useEditor.setState(s=>({project:{...s.project,objects:brushes,terrainGroups:[group]}}));
  await until(()=>a.client.useBuildTogether.getState().pendingChanges===0&&b.useEditor.getState().project.objects.length===512&&b.useEditor.getState().project.terrainGroups?.length===1);
  assert.equal(a.client.useBuildTogether.getState().status,'online');assert.equal(b.client.useBuildTogether.getState().status,'online');
  assert.equal(b.useEditor.getState().history.length,70,'Undo history must be preserved and rebased');
  assert.equal(b.useEditor.getState().history[69].objects.length,512,'history checkpoints must include remote geometry');
  const light={id:'friend-light',kind:'entity',name:'Light',classname:'light',position:[10,5,70],props:{_light:'255 255 255 200'}};
  b.useEditor.setState(s=>({project:{...s.project,objects:[...s.project.objects,light]}}));
  await until(()=>a.useEditor.getState().project.objects.some(o=>o.id==='friend-light')&&a.client.useBuildTogether.getState().pendingChanges===0);
  assert.equal(a.client.useBuildTogether.getState().status,'online');assert.equal(b.client.useBuildTogether.getState().status,'online');
  assert.equal(a.useEditor.getState().project.objects.length,513);
 }finally{
  a?.client.leaveBuildTogether();b?.client.leaveBuildTogether();await sleep(100);service.closeRoom();await new Promise(done=>service.server.close(done));
  globalThis.location=old.location;globalThis.sessionStorage=old.storage;await rm(dir,{recursive:true,force:true});
 }
});


test('BuildTogether 3.5 keeps 12x12 and 16x16 terrain online across a 64 KiB per-frame transport, including a late join',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bt165-fragments-'));
 const old={location:globalThis.location,storage:globalThis.sessionStorage,webSocket:globalThis.WebSocket};
 const oldFrame=Peer.prototype.makeFrame;
 let receivedChunks=0,clientChunks=0,maxSent=0,maxReceived=0;
 class LimitedWebSocket extends old.webSocket{
  send(data){const size=Buffer.byteLength(data);clientChunks++;maxSent=Math.max(maxSent,size);
   if(size>64*1024){this.close(1009,'Frame too large');throw Error('TCP bridge rejected browser frame '+size);}
   return super.send(data);
  }
 }
 // Enforce the same restriction on the server -> client direction.
 Peer.prototype.makeFrame=function(op,bytes){const frame=oldFrame.call(this,op,bytes);if(op===1&&this.protocol===4){receivedChunks++;maxReceived=Math.max(maxReceived,bytes.length);if(bytes.length>64*1024)throw Error('TCP bridge rejected server frame '+bytes.length);}return frame;};
 globalThis.WebSocket=LimitedWebSocket;globalThis.location={protocol:'http:'};
 const backups=new Map();globalThis.sessionStorage={getItem:k=>backups.get(k)||null,setItem:(k,v)=>backups.set(k,v)};
 const route={},app={post:(path,fn)=>route[path]=fn};const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 await new Promise(done=>service.server.listening?done():service.server.once('listening',done));
 let response;route['/api/buildtogether/create']({body:{project}},{set(){return this},status(){return this},json(data){response=data}});
 let a,b,late;
 try{
  await writeFile(join(dir,'zustand.mjs'),zustand);
  a=await clientAt(dir,'host');b=await clientAt(dir,'guest');late=await clientAt(dir,'late');
  const endpoint=`127.0.0.1:${service.server.address().port}`;
  await a.client.joinBuildTogether(endpoint,response.code,'Host',{hostKey:response.hostKey});
  await b.client.joinBuildTogether(endpoint,response.code,'Guest');
  const terrain=(n,id)=>{
   const brushes=Array.from({length:2*n*n},(_,i)=>({...brick(i),id:`${id}-${i}`,name:`${id} cell ${i}`}));
   const group={id,name:id,origin:[0,0,0],width:512,depth:512,resolution:n,heights:Array((n+1)**2).fill(0),texture:'SV_BRICK01',baseDepth:96,brushIds:brushes.map(o=>o.id),brushSignatures:brushes.map(()=> 'v2:123456789abcdef0')};
   return {brushes,group};
  };
  const first=terrain(12,'hill-12');
  a.useEditor.setState(s=>({project:{...s.project,objects:first.brushes,terrainGroups:[first.group]}}));
  await until(()=>a.client.useBuildTogether.getState().pendingChanges===0&&b.useEditor.getState().project.objects.length===288&&b.useEditor.getState().project.terrainGroups?.length===1,30000);
  assert.equal(a.client.useBuildTogether.getState().status,'online');assert.equal(b.client.useBuildTogether.getState().status,'online');
  const second=terrain(16,'hill-16');
  b.useEditor.setState(s=>({project:{...s.project,objects:[...s.project.objects,...second.brushes],terrainGroups:[...s.project.terrainGroups,second.group]}}));
  await until(()=>b.client.useBuildTogether.getState().pendingChanges===0&&a.useEditor.getState().project.objects.length===800&&a.useEditor.getState().project.terrainGroups?.length===2,30000);
  assert.equal(a.client.useBuildTogether.getState().status,'online');assert.equal(b.client.useBuildTogether.getState().status,'online');
  await late.client.joinBuildTogether(endpoint,response.code,'Late');
  assert.equal(late.useEditor.getState().project.objects.length,800,'Late joiner must reassemble a fragmented snapshot');
  assert.equal(late.useEditor.getState().project.terrainGroups.length,2);
  assert.ok(clientChunks>20,'Client must split terrain into multiple small packets');
  assert.ok(receivedChunks>20,'Server must split incoming terrain for both receivers');
  assert.ok(maxSent<32768,`Largest client frame ${maxSent} bytes`);
  assert.ok(maxReceived<32768,`Largest server frame ${maxReceived} bytes`);
 }finally{
  for(const user of [a,b,late])user?.client.leaveBuildTogether();
  await sleep(100);service.closeRoom();await new Promise(done=>service.server.close(done));
  globalThis.WebSocket=old.webSocket;globalThis.location=old.location;globalThis.sessionStorage=old.storage;
  Peer.prototype.makeFrame=oldFrame;await rm(dir,{recursive:true,force:true});
 }
});
