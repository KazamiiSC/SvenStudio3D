import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {create} from 'zustand';
import express from 'express';
import {attachBuildTogether} from '../server/buildTogether.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
const base={version:1,name:'terrain-bt',objects:[{kind:'entity',id:'spawn',name:'spawn',classname:'info_player_start',position:[0,0,24],props:{},layer:'Gameplay'}],world:{classname:'worldspawn'},wadNames:[]};
async function waitFor(predicate,ms=17000){const end=Date.now()+ms;while(Date.now()<end){if(predicate())return;await sleep(20);}throw Error('Timed out waiting for BuildTogether terrain synchronization');}
const next=(ws,type)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Missing '+type)),4000);function listener(e){let m;try{m=JSON.parse(e.data)}catch{return}if(m.type!==type)return;clearTimeout(timer);ws.removeEventListener('message',listener);resolve(m)}ws.addEventListener('message',listener)});
function brush(i,changed=0){return {kind:'brush',id:'terrain-'+i,name:'Slope '+i,primitive:'poly',position:[i,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'Terrain',group:'Terrain A',vertices:[[0,0,0],[10,0,changed],[0,10,0],[0,0,-96],[10,0,-96],[0,10,-96]],faces:[[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]].map(indices=>({indices,texture:'STONE'}))};}
function terrainMeta(objects){return [{id:'terrain-group',name:'Terrain A',origin:[0,0,0],width:512,depth:512,resolution:16,heights:Array(289).fill(0),texture:'STONE',baseDepth:96,brushIds:objects.map(b=>b.id),brushSignatures:objects.map(b=>JSON.stringify([b.position,b.rotation,b.scale,b.vertices,b.faces,b.entityId]))}];}
test('generated 16-resolution terrain remains on server and all peers; metadata commits only after 512 brushes',async()=>{
 const temp=await mkdtemp(resolve('.tmp-terrain-v1522-'));
 const oldLocation=globalThis.location;globalThis.location={protocol:'http:'};
 const code=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../src/engine/buildTogetherClient.ts',import.meta.url),'utf8'));
 const output=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from '../store'","from './fakeStore.mjs'");
 await writeFile(join(temp,'client.mjs'),output);
 await writeFile(join(temp,'fakeStore.mjs'),`import {create} from 'zustand';\nexport const useEditor=create(()=>({project:${JSON.stringify(base)},selected:null,selectedIds:[],history:[],future:[],appendLogs:()=>{}}));`);
 const client=await import(pathToFileURL(join(temp,'client.mjs')).href);
 const {useEditor}=await import(pathToFileURL(join(temp,'fakeStore.mjs')).href);
 const app=express();app.use(express.json({limit:'20mb'}));const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 await new Promise(ok=>service.server.listening?ok():service.server.once('listening',ok));const port=service.server.address().port;
 const api=app.listen(0,'127.0.0.1');await new Promise(ok=>api.once('listening',ok));
 let host,late;
 try{
  const resp=await fetch(`http://127.0.0.1:${api.address().port}/api/buildtogether/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:base})});
  const {code:invite,hostKey}=await resp.json();assert.ok(invite);
  host=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);await new Promise(ok=>host.addEventListener('open',ok,{once:true}));
  const snapshot=next(host,'snapshot');host.send(JSON.stringify({type:'join',code:invite,hostKey,name:'Host'}));await snapshot;
  const packets=[],rejected=[];host.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='change')packets.push(m);if(m.type==='rejected')rejected.push(m)});
  await client.joinBuildTogether(`127.0.0.1:${port}`,invite,'Terrain mapper');
  const geometry=Array.from({length:512},(_,i)=>brush(i));
  useEditor.setState(s=>({project:{...s.project,objects:[...s.project.objects,...geometry],terrainGroups:terrainMeta(geometry)}}));
  await waitFor(()=>client.useBuildTogether.getState().pendingChanges===0&&packets.length>=4);
  assert.equal(packets.length,4,'512 generated brushes must use 4 acknowledged batches');
  assert.deepEqual(packets.map(p=>p.ops.length),[128,128,128,128]);
  assert.deepEqual(packets.map(p=>Boolean(p.meta)),[false,false,false,true],'terrain metadata must not reference missing brushes');
  assert.equal(rejected.length,0);
  late=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);await new Promise(ok=>late.addEventListener('open',ok,{once:true}));
  const latest=next(late,'snapshot');late.send(JSON.stringify({type:'join',code:invite,name:'Late mapper'}));const result=await latest;
  assert.equal(result.project.objects.length,513);
  assert.equal(result.project.terrainGroups[0].brushIds.length,512);
  assert.ok(result.project.terrainGroups[0].brushIds.every(id=>result.project.objects.some(o=>o.id===id)));
  // A subsequent terrain resculpt updates existing ids and metadata.
  const modified=geometry.map((o,i)=>brush(i,i%6));
  const before=client.useBuildTogether.getState().revision;
  useEditor.setState(s=>({project:{...s.project,objects:[base.objects[0],...modified],terrainGroups:terrainMeta(modified)}}));
  // Another mapper inserts an unrelated light before the resculpt has flushed.
  const remoteLight={kind:'entity',id:'remote-light',name:'Light',classname:'light',position:[33,7,80],props:{_light:'255 255 255 250'},layer:'Lighting'};
  host.send(JSON.stringify({type:'change',base:before,ops:[{kind:'put',id:remoteLight.id,object:remoteLight}]}));
  await waitFor(()=>client.useBuildTogether.getState().pendingChanges===0&&client.useBuildTogether.getState().revision>=before+2);
  assert.equal(useEditor.getState().project.objects.length,514,'terrain and concurrent light should both persist locally');
  assert.ok(useEditor.getState().project.objects.some(o=>o.id==='remote-light'));
  assert.equal(useEditor.getState().project.terrainGroups[0].brushSignatures.length,512);
  const verify=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);
  await new Promise(ok=>verify.addEventListener('open',ok,{once:true}));
  const final=next(verify,'snapshot');verify.send(JSON.stringify({type:'join',code:invite,name:'Verifier'}));
  const checked=await final;assert.equal(checked.project.objects.length,514);assert.equal(checked.project.terrainGroups[0].brushIds.length,512);verify.close();
 }finally{
  client.leaveBuildTogether();host?.close();late?.close();await sleep(75);service.closeRoom();await new Promise(ok=>api.close(ok));await new Promise(ok=>service.server.close(ok));globalThis.location=oldLocation;await rm(temp,{recursive:true,force:true});
 }
});
