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
const project={version:1,name:'presence_test',objects:[],world:{classname:'worldspawn'},wadNames:[]};
const pose={projection:'perspective',position:[30,50,70],target:[0,0,0],up:[0,1,0],orthoHeight:900,fov:58,aspect:1.78};
const zustand=`export function create(init){let state;const ls=new Set;const hook=sel=>sel(state);hook.getState=()=>state;hook.setState=p=>{const prev=state;state={...state,...(typeof p==='function'?p(state):p)};for(const cb of ls)cb(state,prev)};hook.subscribe=cb=>{ls.add(cb);return()=>ls.delete(cb)};state=init(hook.setState,hook.getState,hook.subscribe);return hook}`;
const fakeStore=`import {create} from './zustand.mjs';export const useEditor=create(()=>({project:${JSON.stringify(project)},selected:null,selectedIds:[],mode:'select',resourceView:'objects',history:[],future:[],appendLogs:()=>{}}))`;
async function setupClient(dir,name){
 await writeFile(join(dir,'store'+name+'.mjs'),fakeStore);
 const source=await readFile(new URL('../src/engine/buildTogetherClient.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'zustand'","from './zustand.mjs'").replace("from '../store'",`from './store${name}.mjs'`);
 await writeFile(join(dir,'client'+name+'.mjs'),code);
 const client=await import(pathToFileURL(join(dir,'client'+name+'.mjs')).href);
 const {useEditor}=await import(pathToFileURL(join(dir,'store'+name+'.mjs')).href);
 return {client,useEditor};
}
function start(){
 const routes={},app={post:(route,callback)=>routes[route]=callback};
 const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 return {service,create:()=>{let response;routes['/api/buildtogether/create']({body:{project}},{set(){return this;},json(x){response=x},status(){return this}});return response}};
}
async function until(fn,timeout=4000){const begin=Date.now();while(!fn()){if(Date.now()-begin>timeout)throw Error('Timed out awaiting presence event');await sleep(25)}}
async function newSocket(port,code,name){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);
 await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true})});
 const snapshot=new Promise(ok=>ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.type==='snapshot')ok(d)}));
 ws.send(JSON.stringify({type:'join',protocol:3,code,name}));return {ws,snapshot:await snapshot};
}
async function cleanup(context,clients,sockets,dir){
 for(const c of clients)c?.client.leaveBuildTogether();for(const s of sockets)try{s.close()}catch{}
 await sleep(80);context.service.closeRoom();await new Promise(ok=>context.service.server.close(ok));await rm(dir,{recursive:true,force:true});
}

test('BuildTogether 3.1 shares activity, RTT and a cached camera without changing map revision',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sven-v161-presence-'));
 const oldLocation=globalThis.location,oldStorage=globalThis.sessionStorage;
 globalThis.location={protocol:'http:'};globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
 const ctx=start();await new Promise(ok=>ctx.service.server.listening?ok():ctx.service.server.once('listening',ok));
 const port=ctx.service.server.address().port,{code,hostKey}=ctx.create();let host,guest,late;
 try{
  await writeFile(join(dir,'zustand.mjs'),zustand);
  host=await setupClient(dir,'host');guest=await setupClient(dir,'guest');
  await host.client.joinBuildTogether(`127.0.0.1:${port}`,code,'Host',{hostKey});
  await guest.client.joinBuildTogether(`127.0.0.1:${port}`,code,'Guest');
  host.client.sendBuildTogetherCamera(pose);
  await until(()=>guest.client.useBuildTogether.getState().cameras[host.client.useBuildTogether.getState().selfId]);
  const received=guest.client.useBuildTogether.getState().cameras[host.client.useBuildTogether.getState().selfId];
  assert.deepEqual(received.position,pose.position);
  assert.equal(received.fov,pose.fov);assert.equal(received.aspect,pose.aspect);
  host.client.setBuildTogetherDialog('terrain');
  await until(()=>guest.client.useBuildTogether.getState().participants.some(p=>p.id===host.client.useBuildTogether.getState().selfId&&p.activity==='terrain'));
  // Late join receives both the last camera and the most recent activity.
  late=await newSocket(port,code,'Late mapper');
  assert.deepEqual(late.snapshot.cameras[host.client.useBuildTogether.getState().selfId].target,pose.target);
  const hostMember=late.snapshot.participants.find(p=>p.id===host.client.useBuildTogether.getState().selfId);
  assert.equal(hostMember.activity,'terrain');
  assert.equal(late.snapshot.revision,0,'presence must not increment shared map revision');
  // The displayed ping is a measured host RTT, not an invented peer latency.
  await until(()=>host.client.useBuildTogether.getState().pingMs!==null,7000);
  await until(()=>guest.client.useBuildTogether.getState().participants.find(p=>p.id===host.client.useBuildTogether.getState().selfId)?.pingMs!==null,2500);
  assert.ok(Number.isInteger(guest.client.useBuildTogether.getState().participants.find(p=>p.id===host.client.useBuildTogether.getState().selfId).pingMs));
  // Activity updates should not erase the previously selected brush or edits.
  assert.equal(guest.useEditor.getState().project.name,'presence_test');
  host.client.setBuildTogetherDialog(null);
  await until(()=>guest.client.useBuildTogether.getState().participants.some(p=>p.id===host.client.useBuildTogether.getState().selfId&&p.activity==='exploring'));
 }finally{await cleanup(ctx,[host,guest],[late?.ws].filter(Boolean),dir);globalThis.location=oldLocation;globalThis.sessionStorage=oldStorage}
});

test('BuildTogether 3.1 rejects invalid status/camera and throttles presence streams',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sven-v161-validation-'));
 const ctx=start();await new Promise(ok=>ctx.service.server.listening?ok():ctx.service.server.once('listening',ok));
 const port=ctx.service.server.address().port,{code,hostKey}=ctx.create();const sockets=[];
 try{
  const first=await newSocket(port,code,'First');sockets.push(first.ws);
  const second=await newSocket(port,code,'Second');sockets.push(second.ws);
  let statusCount=0,cameraCount=0;
  second.ws.addEventListener('message',e=>{const msg=JSON.parse(e.data);if(msg.type==='member-status')statusCount++;if(msg.type==='camera')cameraCount++});
  first.ws.send(JSON.stringify({type:'member-status',activity:'C:/private/projects',pingMs:4}));
  first.ws.send(JSON.stringify({type:'camera',pose:{...pose,aspect:10000}}));
  await sleep(90);assert.equal(statusCount,0);assert.equal(cameraCount,0);
  first.ws.send(JSON.stringify({type:'member-status',activity:'npc',pingMs:87}));
  await until(()=>statusCount===1);
  for(let i=0;i<20;i++)first.ws.send(JSON.stringify({type:'member-status',activity:i%2?'terrain':'lighting',pingMs:i}));
  for(let i=0;i<30;i++)first.ws.send(JSON.stringify({type:'camera',pose:{...pose,position:[30+i,50,70]}}));
  await sleep(150);
  assert.equal(statusCount,1,'activity packets must be throttled');
  assert.ok(cameraCount<=3,'rapid camera packets must be limited server-side');
  assert.equal(first.snapshot.revision,0);
  // No invalid camera should be cached; late joins see only an accepted pose.
  const late=await newSocket(port,code,'Late');sockets.push(late.ws);
  assert.ok(late.snapshot.cameras[first.snapshot.selfId]);
  assert.equal(late.snapshot.participants.find(p=>p.id===first.snapshot.selfId).activity,'npc');
 }finally{await cleanup(ctx,[],sockets,dir)}
});
