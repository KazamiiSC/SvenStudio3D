import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {attachBuildTogether} from '../server/buildTogether.js';
import {setTimeout as sleep} from 'node:timers/promises';
const map={version:1,name:'online-map',objects:[{kind:'entity',id:'spawn',name:'Spawn',classname:'info_player_start',position:[0,0,48],props:{},layer:'Gameplay'}],world:{classname:'worldspawn'},wadNames:[]};
async function listen(server){await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));return server.address().port;}
function next(ws,type,timeout=3000,predicate=()=>true){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(Error('Timed out: '+type));},timeout);const onMessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return;}if(m.type!==type||!predicate(m))return;clearTimeout(timer);ws.removeEventListener('message',onMessage);resolve(m);};ws.addEventListener('message',onMessage);});}
async function connect(port,credentials){const ws=new WebSocket(`ws://127.0.0.1:${port}/buildtogether`);await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true})});const received=next(ws,'snapshot');ws.send(JSON.stringify({type:'join',...credentials}));return {ws,snapshot:await received};}
async function fixture(){const app=express();app.use(express.json({limit:'20mb'}));const service=attachBuildTogether(app,{port:0,listen:'127.0.0.1'});const port=await listen(service.server);const api=app.listen(0,'127.0.0.1');await listen(api);const sockets=[];
 const resp=await fetch(`http://127.0.0.1:${api.address().port}/api/buildtogether/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:map})});assert.equal(resp.status,200);const {code,hostKey}=await resp.json();
 return {port,code,hostKey,sockets,async join(credentials){const value=await connect(port,{code,...credentials});sockets.push(value.ws);return value;},async close(){for(const socket of sockets)try{socket.close()}catch{};await sleep(50);service.closeRoom();await new Promise(resolve=>api.close(resolve));await new Promise(resolve=>service.server.close(resolve));}};
}
test('BT 2.0: ping RTT, cursor fan-out and live object-lock exclusion',async()=>{const f=await fixture();try{
 const a=await f.join({hostKey:f.hostKey,name:'host'});const b=await f.join({name:'guest'});
 const pong=next(b.ws,'pong');b.ws.send(JSON.stringify({type:'ping',nonce:17}));assert.equal((await pong).nonce,17);
 const cursor=next(a.ws,'cursor');b.ws.send(JSON.stringify({type:'cursor',x:.2,y:.6}));const evt=await cursor;assert.equal(evt.id,b.snapshot.selfId);assert.equal(evt.x,.2);
 const lock=next(a.ws,'presence');b.ws.send(JSON.stringify({type:'selection',ids:['spawn']}));assert.deepEqual((await lock).locks,[{id:'spawn',owner:b.snapshot.selfId}]);
 const denied=next(a.ws,'rejected');a.ws.send(JSON.stringify({type:'change',base:0,ops:[{kind:'delete',id:'spawn'}]}));assert.match((await denied).reason,/locked/);
 const released=next(a.ws,'presence');b.ws.send(JSON.stringify({type:'selection',ids:[]}));assert.equal((await released).locks.length,0);
 }finally{await f.close();}});
test('BT 2.0: host reconnects with same identity after a network disconnect; guests keep editing',async()=>{const f=await fixture();try{
 const a=await f.join({hostKey:f.hostKey,name:'host'});const b=await f.join({name:'guest'});
 const loss=next(b.ws,'presence');a.ws.close();const away=await loss;assert.equal(away.participants.some(p=>p.role==='host'),false);
 const edit=next(b.ws,'change');b.ws.send(JSON.stringify({type:'change',base:0,ops:[{kind:'put',id:'spawn',object:{...map.objects[0],position:[42,3,4]}}]}));assert.equal((await edit).revision,1);
 const resumed=await f.join({hostKey:f.hostKey,name:'host',resumeKey:a.snapshot.resumeKey});
 assert.equal(resumed.snapshot.role,'host');assert.equal(resumed.snapshot.selfId,a.snapshot.selfId);
 assert.deepEqual(resumed.snapshot.project.objects[0].position,[42,3,4]);assert.equal(resumed.snapshot.revision,1);
 // A normal leave by the host closes the room immediately, unlike a network loss.
 const closed=next(b.ws,'closed');resumed.ws.send(JSON.stringify({type:'leave'}));assert.match((await closed).reason,/ended/);
 }finally{await f.close();}});
test('BT 2.0: reconnect clears stale object locks and preserves guest identity',async()=>{const f=await fixture();try{
 const a=await f.join({hostKey:f.hostKey,name:'host'});const b=await f.join({name:'guest'});
 const first=next(a.ws,'presence',3000,m=>m.locks?.length===1);b.ws.send(JSON.stringify({type:'selection',ids:['spawn']}));assert.equal((await first).locks.length,1);
 const second=next(a.ws,'presence',3000,m=>m.locks?.length===0);b.ws.close();assert.equal((await second).locks.length,0);
 const resumed=await f.join({name:'guest',resumeKey:b.snapshot.resumeKey});
 assert.equal(resumed.snapshot.selfId,b.snapshot.selfId);assert.equal(resumed.snapshot.locks.length,0);
 const edit=next(a.ws,'change');a.ws.send(JSON.stringify({type:'change',base:0,ops:[{kind:'put',id:'spawn',object:{...map.objects[0],position:[6,6,6]}}]}));assert.equal((await edit).revision,1);
 }finally{await f.close();}});
