import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {attachBuildTogether,validSharedProject} from '../server/buildTogether.js';
import {setTimeout as delay} from 'node:timers/promises';
const base={version:1,name:'collab_test',objects:[{kind:'entity',id:'spawn1',name:'Start',classname:'info_player_start',position:[0,0,32],props:{},layer:'Gameplay'}],world:{classname:'worldspawn'},wadNames:[]};
function nextMessage(socket,kind,timeout=2000){return new Promise((resolve,reject)=>{const alarm=setTimeout(()=>{socket.removeEventListener('message',handle);reject(Error('Timed out waiting for '+kind))},timeout);const handle=ev=>{let parsed;try{parsed=JSON.parse(ev.data)}catch{return}if(parsed.type!==kind)return;clearTimeout(alarm);socket.removeEventListener('message',handle);resolve(parsed)};socket.addEventListener('message',handle)})}
function connected(socket){return new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})}
test('BuildTogether maps, collaboration, ownership locks and spectator protection',async()=>{
 assert.equal(validSharedProject(base),true);
 assert.equal(validSharedProject({...base,objects:[base.objects[0],base.objects[0]]}),false);
 const app=express();app.use(express.json({limit:'20mb'}));
 const {server}=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});
 await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));
 const port=server.address().port;
 const api=app.listen(0,'127.0.0.1');await new Promise(resolve=>api.once('listening',resolve));
 const sockets=[];
 try{
  const response=await fetch(`http://127.0.0.1:${api.address().port}/api/buildtogether/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:base})});
  assert.equal(response.status,200);const {code,hostKey}=await response.json();assert.equal(code.length,36);
  const host=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);sockets.push(host);await connected(host);
  const first=nextMessage(host,'snapshot');host.send(JSON.stringify({type:'join',hostKey,code,name:'host'}));
  const hostState=await first;assert.equal(hostState.project.objects.length,1);assert.equal(hostState.role,'host');
  const guest=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);sockets.push(guest);await connected(guest);
  const second=nextMessage(guest,'snapshot');guest.send(JSON.stringify({type:'join',code,name:'guest'}));
  const guestState=await second;assert.equal(guestState.role,'editor');assert.equal(guestState.participants.length,2);
  const lockNotice=nextMessage(host,'presence');guest.send(JSON.stringify({type:'selection',ids:['spawn1']}));await lockNotice;
  const rejected=nextMessage(host,'rejected');host.send(JSON.stringify({type:'change',base:0,ops:[{kind:'put',id:'spawn1',object:{...base.objects[0],position:[1,2,3]}}]}));
  const denied=await rejected;assert.match(denied.reason,/locked/);assert.equal(denied.project.objects[0].position[0],0);
  const guestChange=nextMessage(host,'change');guest.send(JSON.stringify({type:'change',base:0,ops:[{kind:'put',id:'spawn1',object:{...base.objects[0],position:[8,8,8]}}]}));
  const changed=await guestChange;assert.equal(changed.revision,1);assert.deepEqual(changed.ops[0].object.position,[8,8,8]);
  // A world setting change with no geometry edits must be synchronized too.
  const worldChanged=nextMessage(host,'change');guest.send(JSON.stringify({type:'change',base:1,ops:[],meta:{name:'map_new_name',version:1,world:{classname:'worldspawn',message:'Cooperative'},wadNames:[]}}));
  const worldEvent=await worldChanged;assert.equal(worldEvent.revision,2);assert.equal(worldEvent.meta.world.message,'Cooperative');
  const watcher=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);sockets.push(watcher);await connected(watcher);
  const observer=nextMessage(watcher,'snapshot');watcher.send(JSON.stringify({type:'join',code,name:'viewer',spectator:true}));
  const viewer=await observer;assert.equal(viewer.role,'spectator');assert.equal(viewer.project.objects[0].position[0],8);
  const noChange=nextMessage(host,'presence');watcher.send(JSON.stringify({type:'change',base:1,ops:[{kind:'delete',id:'spawn1'}]}));
  // Another join causes presence. Spectator's invalid editing request must be ignored.
  await delay(80);
  const late=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);sockets.push(late);await connected(late);
  const lateState=nextMessage(late,'snapshot');late.send(JSON.stringify({type:'join',code,name:'late'}));assert.equal((await lateState).project.objects.length,1);
  noChange.catch(()=>{});
 }finally{for(const sock of sockets)sock.close();await delay(40);await new Promise(resolve=>api.close(resolve));await new Promise(resolve=>server.close(resolve));}
});
