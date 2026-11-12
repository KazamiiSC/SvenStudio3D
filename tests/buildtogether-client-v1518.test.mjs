import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import express from 'express';
import {attachBuildTogether} from '../server/buildTogether.js';
import {setTimeout as sleep} from 'node:timers/promises';
const base={version:1,name:'client-ack-test',objects:[{kind:'entity',id:'one',name:'spawn',classname:'info_player_start',position:[0,0,48],props:{},layer:'Gameplay'}],world:{classname:'worldspawn'},wadNames:[]};
function next(ws,type){return new Promise((ok,bad)=>{const timer=setTimeout(()=>bad(Error('Timed out '+type)),3000);const handle=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type!==type)return;clearTimeout(timer);ws.removeEventListener('message',handle);ok(m)};ws.addEventListener('message',handle)});}
function changed(ws){const events=[];const handler=e=>{let m;try{m=JSON.parse(e.data)}catch{return;}if(m.type==='change')events.push(m);};ws.addEventListener('message',handler);return {events,stop:()=>ws.removeEventListener('message',handler)};}
async function until(check,timeout=5000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(check())return;await sleep(25);}throw Error('Timed out waiting for client acknowledgement');}
test('BT 2.0 client: coalesces frequent drags and serializes multi-batch edits against acknowledgements',async()=>{
 const temp=await mkdtemp(resolve('.tmp-bt-client-'));
 const previousLocation=globalThis.location;globalThis.location={protocol:'http:'};
 const source=await readFile(new URL('../src/engine/buildTogetherClient.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from '../store'","from './fakeStore.mjs'");
 await writeFile(join(temp,'client.mjs'),compiled);
 await writeFile(join(temp,'fakeStore.mjs'),`import {create} from 'zustand';\nexport const useEditor=create(()=>({project:${JSON.stringify(base)},selected:null,selectedIds:[],history:[],future:[],appendLogs:()=>{}}));`);
 const client=await import(pathToFileURL(join(temp,'client.mjs')).href);const {useEditor}=await import(pathToFileURL(join(temp,'fakeStore.mjs')).href);
 const app=express();app.use(express.json({limit:'20mb'}));const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 await new Promise(ok=>service.server.listening?ok():service.server.once('listening',ok));const port=service.server.address().port;
 const api=app.listen(0,'127.0.0.1');await new Promise(ok=>api.once('listening',ok));
 let host;
 try{
  const response=await fetch(`http://127.0.0.1:${api.address().port}/api/buildtogether/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:base})});
  const {code,hostKey}=await response.json();host=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);await new Promise(ok=>host.addEventListener('open',ok,{once:true}));
  const hostSnapshot=next(host,'snapshot');host.send(JSON.stringify({type:'join',code,hostKey,name:'host'}));await hostSnapshot;
  await client.joinBuildTogether(`127.0.0.1:${port}`,code,'guest');
  const record=changed(host);
  for(let i=1;i<=18;i++){
   useEditor.setState(s=>({project:{...s.project,objects:s.project.objects.map(o=>o.id==='one'?{...o,position:[i,0,48]}:o)}}));
  }
  await until(()=>client.useBuildTogether.getState().pendingChanges===0&&record.events.some(e=>e.ops.some(op=>op.id==='one'&&op.object?.position[0]===18)));
  assert.ok(record.events.length<=3,`Expected coalescing rather than 18 separate network changes, got ${record.events.length}`);
  assert.equal(client.useBuildTogether.getState().status,'online');
  const initialRevision=client.useBuildTogether.getState().revision;
  const many=Array.from({length:270},(_,i)=>({kind:'entity',id:`new-${i}`,name:'test',classname:'info_player_start',position:[i,0,32],props:{},layer:'Gameplay'}));
  useEditor.setState(s=>({project:{...s.project,objects:[...s.project.objects,...many]}}));
  await until(()=>client.useBuildTogether.getState().revision>=initialRevision+3&&client.useBuildTogether.getState().pendingChanges===0,7000);
  const after=await fetch(`http://127.0.0.1:${api.address().port}/api/buildtogether/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:base})});
  assert.equal(after.status,409,'Original collaborative room must remain active');
  const late=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);await new Promise(ok=>late.addEventListener('open',ok,{once:true}));
  const snapshot=next(late,'snapshot');late.send(JSON.stringify({type:'join',code,name:'late'}));const latest=await snapshot;late.close();
  assert.equal(latest.project.objects.length,271);
  assert.equal(latest.project.objects.find(o=>o.id==='one').position[0],18);
  assert.equal(record.events.filter(e=>e.revision>initialRevision).length,3,'270 objects must be sent in three acknowledged batches');
  record.stop();
 }finally{
  client.leaveBuildTogether();host?.close();await sleep(80);service.closeRoom();await new Promise(ok=>api.close(ok));await new Promise(ok=>service.server.close(ok));
  globalThis.location=previousLocation;await rm(temp,{recursive:true,force:true});
 }
});
test('BT 2.0 client: automatic reconnect resumes identity and editing after a dropped socket',async()=>{
 const temp=await mkdtemp(resolve('.tmp-bt-reconnect-'));
 const previousLocation=globalThis.location,NativeWebSocket=globalThis.WebSocket,oldStorage=globalThis.sessionStorage;
 globalThis.location={protocol:'http:'};
 const sockets=[];
 globalThis.WebSocket=class CapturedWebSocket extends NativeWebSocket {constructor(...args){super(...args);sockets.push(this);}};
 const saved=new Map();globalThis.sessionStorage={setItem(k,v){saved.set(k,v);},getItem(k){return saved.get(k)??null;}};
 const source=await readFile(new URL('../src/engine/buildTogetherClient.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from '../store'","from './fakeStore.mjs'");
 await writeFile(join(temp,'client.mjs'),compiled);
 await writeFile(join(temp,'fakeStore.mjs'),`import {create} from 'zustand';\nexport const useEditor=create(()=>({project:${JSON.stringify(base)},selected:null,selectedIds:[],history:[],future:[],appendLogs:()=>{}}));`);
 const client=await import(pathToFileURL(join(temp,'client.mjs')).href);
 const app=express();app.use(express.json({limit:'20mb'}));const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 await new Promise(ok=>service.server.listening?ok():service.server.once('listening',ok));const port=service.server.address().port;
 const api=app.listen(0,'127.0.0.1');await new Promise(ok=>api.once('listening',ok));let host;
 try{
  const response=await fetch(`http://127.0.0.1:${api.address().port}/api/buildtogether/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:base})});
  const {code,hostKey}=await response.json();host=new NativeWebSocket(`ws://127.0.0.1:${port}/buildtogether`);await new Promise(ok=>host.addEventListener('open',ok,{once:true}));const hosted=next(host,'snapshot');host.send(JSON.stringify({type:'join',code,hostKey,name:'host'}));await hosted;
  await client.joinBuildTogether(`127.0.0.1:${port}`,code,'guest');
  const oldId=client.useBuildTogether.getState().selfId;assert.equal(sockets.length,1);
  sockets[0].close();
  await until(()=>client.useBuildTogether.getState().status==='reconnecting');
  const {useEditor}=await import(pathToFileURL(join(temp,'fakeStore.mjs')).href);
  useEditor.setState(s=>({project:{...s.project,objects:s.project.objects.map(o=>({...o,position:[99,99,99]}))}}));
  await until(()=>client.useBuildTogether.getState().status==='online'&&sockets.length>=2,6500);
  assert.equal(client.useBuildTogether.getState().hasRecoveryBackup,true);
  assert.equal(JSON.parse(saved.get('svenstudio:buildtogether-disconnected-backup')).objects[0].position[0],99);
  assert.equal(client.useBuildTogether.getState().selfId,oldId);
  const events=next(host,'change');
  // Continue normal edits with the resumed channel.
  useEditor.setState(s=>({project:{...s.project,objects:s.project.objects.map(o=>({...o,position:[9,9,9]}))}}));
  assert.equal((await events).ops[0].object.position[0],9);
 }finally{
  client.leaveBuildTogether();host?.close();await sleep(80);service.closeRoom();await new Promise(ok=>api.close(ok));await new Promise(ok=>service.server.close(ok));
  globalThis.WebSocket=NativeWebSocket;globalThis.location=previousLocation;globalThis.sessionStorage=oldStorage;await rm(temp,{recursive:true,force:true});
 }
});
