import test from 'node:test';
import assert from 'node:assert/strict';
import {attachBuildTogether,validSharedProject} from '../server/buildTogether.js';
import {setTimeout as sleep} from 'node:timers/promises';

const project={version:1,name:'study_test',objects:[{kind:'entity',id:'spawn',name:'Start',classname:'info_player_start',position:[0,0,32],props:{}}],world:{classname:'worldspawn'},wadNames:[]};
function receive(ws,type,timeout=2500){return new Promise((resolve,reject)=>{const t=setTimeout(()=>{ws.removeEventListener('message',handler);reject(Error(`Timed out waiting for ${type}`));},timeout);function handler(e){let m;try{m=JSON.parse(e.data)}catch{return;}if(m.type!==type)return;clearTimeout(t);ws.removeEventListener('message',handler);resolve(m);}ws.addEventListener('message',handler);});}
async function newSocket(port,code,{protocol=3,hostKey,spectator=false,name='Mapper'}={}){const ws=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});const welcome=receive(ws,'snapshot');ws.send(JSON.stringify({type:'join',protocol,code,hostKey,name,spectator}));return {ws,snapshot:await welcome};}
async function start(){const routes={};const app={post:(name,callback)=>routes[name]=callback};const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});await new Promise(ok=>service.server.listening?ok():service.server.once('listening',ok));const port=service.server.address().port;let result;routes['/api/buildtogether/create']({body:{project}},{set(){return this;},json(data){result=data;return this;},status(){return this;}});return {...result,service,port};}
async function shut(ctx,sockets){for(const ws of sockets){try{ws.close()}catch{}}await sleep(55);ctx.service.closeRoom();await new Promise(ok=>ctx.service.server.close(ok));}
const sendChange=(ws,base,ops=[],metaPatch)=>ws.send(JSON.stringify({type:'change',base,ops,...(metaPatch?{metaPatch}:{})}));

test('BuildTogether only accepts shared project keys, not local compiler paths',()=>{
 assert.equal(validSharedProject(project),true);
 assert.equal(validSharedProject({...project,sdkPath:'C:/local/private/sdk'}),false);
 assert.equal(validSharedProject({...project,compilerConfig:{path:'C:/local/sdk'}}),false);
});

test('BuildTogether 3.0 merges independent studio metadata edits at one base revision, with v2 interoperability',async()=>{
 const ctx=await start();const sockets=[];
 try{
  const host=await newSocket(ctx.port,ctx.code,{hostKey:ctx.hostKey});sockets.push(host.ws);
  const guest=await newSocket(ctx.port,ctx.code);sockets.push(guest.ws);
  const legacy=await newSocket(ctx.port,ctx.code,{protocol:2});sockets.push(legacy.ws);
  const terrain=receive(host.ws,'change');sendChange(host.ws,0,[],{set:{terrainGroups:[{id:'terrain_1',brushIds:[]}]},unset:[]});
  const terrainResult=await terrain;assert.deepEqual(terrainResult.metaPatch.set.terrainGroups[0].id,'terrain_1');
  const camera=receive(host.ws,'change');sendChange(guest.ws,0,[],{set:{cinematicPreviewSpeeds:{corner1:175}},unset:[]});
  const cameraResult=await camera;assert.equal(cameraResult.revision,2);assert.equal(cameraResult.metaPatch.set.cinematicPreviewSpeeds.corner1,175);
  const old=await newSocket(ctx.port,ctx.code,{protocol:2,name:'Legacy late'});sockets.push(old.ws);
  assert.equal(old.snapshot.project.cinematicPreviewSpeeds.corner1,175);
  assert.equal(old.snapshot.project.terrainGroups[0].id,'terrain_1');
  const legacyMeta=receive(legacy.ws,'change');sendChange(host.ws,2,[],{set:{surfaceSounds:{METAL:'M'}},unset:[]});
  const broadcast=await legacyMeta;assert.equal(broadcast.meta.surfaceSounds.METAL,'M');assert.equal(broadcast.meta.cinematicPreviewSpeeds.corner1,175);
  assert.equal(broadcast.metaPatch,undefined,'v2 clients must receive full metadata, not a v3-only patch');
  const deletion=receive(host.ws,'change');sendChange(guest.ws,3,[],{set:{},unset:['cinematicPreviewSpeeds']});
  const removed=await deletion;assert.deepEqual(removed.metaPatch.unset,['cinematicPreviewSpeeds']);
  const final=await newSocket(ctx.port,ctx.code);sockets.push(final.ws);
  assert.equal(final.snapshot.project.cinematicPreviewSpeeds,undefined);
  assert.equal(final.snapshot.project.terrainGroups.length,1);
  // A legacy participant may still send its full metadata format. The v3
  // participant must receive an equivalent field-level update.
  const legacyToV3=receive(host.ws,'change');
  const {objects:_objects,...oldMeta}=final.snapshot.project;
  old.ws.send(JSON.stringify({type:'change',base:4,ops:[],meta:{...oldMeta,name:'legacy_renamed'}}));
  const legacyBridge=await legacyToV3;
  assert.equal(legacyBridge.metaPatch.set.name,'legacy_renamed');
  assert.equal(legacyBridge.meta,undefined);
 }finally{await shut(ctx,sockets);}
});

test('BuildTogether 3.0 rejects stale same-studio updates and unsafe project metadata',async()=>{
 const ctx=await start();const sockets=[];
 try{
  const a=await newSocket(ctx.port,ctx.code,{hostKey:ctx.hostKey});sockets.push(a.ws);
  const b=await newSocket(ctx.port,ctx.code);sockets.push(b.ws);
  const ack=receive(a.ws,'change');sendChange(a.ws,0,[],{set:{terrainGroups:[{id:'terrain_a'}]},unset:[]});await ack;
  const denied=receive(b.ws,'rejected');sendChange(b.ws,0,[],{set:{terrainGroups:[{id:'terrain_b'}]},unset:[]});
  const conflict=await denied;assert.match(conflict.reason,/terrainGroups/);assert.equal(conflict.project.terrainGroups[0].id,'terrain_a');
  const unsafe=receive(b.ws,'rejected');sendChange(b.ws,1,[],{set:{__proto__:123,objects:[]},unset:[]});
  assert.match((await unsafe).reason,/Invalid studio/);
  const invalid=receive(a.ws,'rejected');sendChange(a.ws,1,[],{set:{name:345},unset:[]});
  assert.match((await invalid).reason,/Invalid shared map/);
  const removal=receive(a.ws,'rejected');sendChange(a.ws,1,[],{set:{},unset:['world']});
  assert.match((await removal).reason,/Invalid shared map/);
  const legacy=await newSocket(ctx.port,ctx.code,{protocol:2});sockets.push(legacy.ws);
  const legacyBad=receive(legacy.ws,'rejected');legacy.ws.send(JSON.stringify({type:'change',base:1,ops:[],meta:{...project,objects:[]}}));
  assert.match((await legacyBad).reason,/Invalid map settings/);
 }finally{await shut(ctx,sockets);}
});

test('BuildTogether 3.0 batches geometry and merges unrelated studio settings, preserving object conflicts',async()=>{
 const ctx=await start();const sockets=[];
 try{
  const a=await newSocket(ctx.port,ctx.code,{hostKey:ctx.hostKey});sockets.push(a.ws);
  const b=await newSocket(ctx.port,ctx.code);sockets.push(b.ws);
  const brushes=Array.from({length:128},(_,i)=>({kind:'brush',id:`terrain_${i}`,name:'Ground',primitive:'box',position:[i*16,0,0],rotation:[0,0,0],scale:[16,16,16],vertices:[],faces:[]}));
  const geometryAck=receive(a.ws,'change');sendChange(a.ws,0,brushes.map(object=>({kind:'put',id:object.id,object})));await geometryAck;
  const metaAck=receive(b.ws,'change');sendChange(b.ws,0,[],{set:{surfaceSounds:{WOOD:'W'}},unset:[]});await metaAck;
  const terrainAck=receive(a.ws,'change');sendChange(a.ws,2,[],{set:{terrainGroups:[{id:'hill',brushIds:brushes.map(brush=>brush.id)}]},unset:[]});await terrainAck;
  const participant=await newSocket(ctx.port,ctx.code);sockets.push(participant.ws);
  assert.equal(participant.snapshot.project.objects.length,129);
  assert.equal(participant.snapshot.project.terrainGroups[0].brushIds.length,128);
  assert.deepEqual(participant.snapshot.project.surfaceSounds,{WOOD:'W'});
  const sameObject=receive(b.ws,'rejected');
  sendChange(b.ws,0,[{kind:'delete',id:'terrain_0'}]);assert.match((await sameObject).reason,/Object changed/);
 }finally{await shut(ctx,sockets);}
});

test('BuildTogether 3.0 keeps spectator read-only and enforces remote object selection locks',async()=>{
 const ctx=await start();const sockets=[];
 try{
  const host=await newSocket(ctx.port,ctx.code,{hostKey:ctx.hostKey});sockets.push(host.ws);
  const editor=await newSocket(ctx.port,ctx.code);sockets.push(editor.ws);
  const spectator=await newSocket(ctx.port,ctx.code,{spectator:true});sockets.push(spectator.ws);
  const selected=receive(host.ws,'presence');editor.ws.send(JSON.stringify({type:'selection',ids:['spawn']}));await selected;
  const rejected=receive(host.ws,'rejected');
  sendChange(host.ws,0,[{kind:'delete',id:'spawn'}]);
  assert.match((await rejected).reason,/locked/);
  sendChange(spectator.ws,0,[],{set:{name:'unauthorized'},unset:[]});
  await sleep(70);
  const check=await newSocket(ctx.port,ctx.code);sockets.push(check.ws);
  assert.equal(check.snapshot.project.name,'study_test');
  assert.equal(check.snapshot.project.objects.length,1);
  assert.equal(check.snapshot.locks[0].owner,editor.snapshot.selfId);
 }finally{await shut(ctx,sockets);}
});
