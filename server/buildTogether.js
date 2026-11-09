/** BuildTogether: isolated, authenticated WebSocket relay for map edits.
 * This service NEVER reads files, compiles, or shares local SDK/game settings.
 * Only the explicitly shared Project is synchronized. Node 22+, no deps.
 */
import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const LIMIT=12*1024*1024;
// Whole 16x16 terrain operations fit into one bounded map transaction.
// This prevents hundreds of meshes from mounting in 4 successive scene rebuilds.
const MAX_CHANGE_OBJECTS=512;
// A large terrain can produce several reliable map batches while the guest
// browser is busy rebuilding the scene. Never drop these batches just because
// TCP has temporarily buffered >4 MiB; pause sending until the socket drains.
const RELIABLE_QUEUE_MAX=40*1024*1024;
const SOCKET_BUFFER_TARGET=256*1024;
// Stay well below the frame sizes that can overwhelm virtual-LAN TCP relays.
// Fragmentation is transport-only: the map is committed/rebuilt once.
const FRAGMENT_BYTES=16*1024;
const FRAGMENT_THRESHOLD=32*1024;
const MAX_FRAGMENTS=Math.ceil(LIMIT/FRAGMENT_BYTES);
const TOKEN=()=>randomBytes(18).toString('hex');
const HOST_RECONNECT_GRACE_MS=45000;
const PEER_SESSION_TTL_MS=90000;
const randomId=()=>randomBytes(8).toString('hex');
const validObject=o=>o&&typeof o==='object'&&!Array.isArray(o)&&typeof o.id==='string'&&o.id.length>0&&o.id.length<=140&&(o.kind==='brush'||o.kind==='entity')&&Array.isArray(o.position)&&o.position.length===3&&o.position.every(v=>Number.isFinite(v)&&Math.abs(v)<10000000);
export function validSharedProject(p){return Boolean(p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).every(key=>key==='objects'||key==='version'||META_FIELDS.has(key))&&p.version===1&&typeof p.name==='string'&&p.name.length<256&&Array.isArray(p.objects)&&p.objects.length<=25000&&p.objects.every(validObject)&&new Set(p.objects.map(o=>o.id)).size===p.objects.length&&p.world&&typeof p.world==='object'&&!Array.isArray(p.world)&&Array.isArray(p.wadNames)&&p.wadNames.length<500);}
const deep=v=>JSON.parse(JSON.stringify(v));
// Project fields consumed by the individual studios. Never accept arbitrary
// property names from a WebSocket packet (including __proto__/constructor).
const META_FIELDS=new Set(['name','world','wadNames','target','graphPositions','cinematicPreviewSpeeds','terrainGroups','architectureLayouts','architectureAssemblies','architectureOpenings','customNpcs','surfaceSounds']);
const ARRAY_STUDIOS=['terrainGroups','architectureLayouts','architectureAssemblies','architectureOpenings','customNpcs'];
const RECORD_STUDIOS=['graphPositions','cinematicPreviewSpeeds','surfaceSounds'];
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const changed=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
const metaFromProject=project=>Object.fromEntries(Object.entries(project).filter(([key])=>key!=='objects'));
function metadataDiff(before,after){
 const set={},unset=[];
 for(const key of META_FIELDS){if(!changed(before[key],after[key]))continue;if(own(after,key))set[key]=deep(after[key]);else unset.push(key);}
 return {set,unset};
}
function validPatch(patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!patch.set||typeof patch.set!=='object'||Array.isArray(patch.set)||!Array.isArray(patch.unset))return false;
 const entries=Object.keys(patch.set),deleted=patch.unset;
 return entries.length+deleted.length>0&&entries.every(key=>META_FIELDS.has(key))&&deleted.every(key=>typeof key==='string'&&META_FIELDS.has(key))&&new Set([...entries,...deleted]).size===entries.length+deleted.length;
}
function applyMetadataPatch(project,patch){
 const next={...project};for(const key of Object.keys(patch.set))next[key]=deep(patch.set[key]);
 for(const key of patch.unset)delete next[key];return next;
}
function validStudioMetadata(project){
 if(project.target!==undefined&&project.target!=='svengine')return false;
 if(Object.values(project.world).some(value=>typeof value!=='string'))return false;
 if(project.wadNames.some(name=>typeof name!=='string'||name.length>255))return false;
 for(const key of ARRAY_STUDIOS)if(project[key]!==undefined&&(!Array.isArray(project[key])||project[key].length>25000||project[key].some(value=>!value||typeof value!=='object'||Array.isArray(value))))return false;
 for(const key of RECORD_STUDIOS)if(project[key]!==undefined&&(!project[key]||typeof project[key]!=='object'||Array.isArray(project[key])||Object.keys(project[key]).length>25000))return false;
 if(project.graphPositions&&Object.values(project.graphPositions).some(value=>!Array.isArray(value)||value.length!==2||!value.every(Number.isFinite)))return false;
 if(project.cinematicPreviewSpeeds&&Object.values(project.cinematicPreviewSpeeds).some(value=>typeof value!=='number'||!Number.isFinite(value)))return false;
 if(project.surfaceSounds&&Object.values(project.surfaceSounds).some(value=>typeof value!=='string'))return false;
 return true;
}
const STATUS_CODES=new Set(['exploring','selecting','moving','rotating','scaling','drawing','texturing','terrain','architecture','npc','sound','lighting','gameplay','cinematic','decals','models','materials','doctor','packager','buildtogether','settings','bsp','visibility','editing','walk','smartbuild']);
const safeToken=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)};
export class Peer{
 constructor(socket,onPacket,onClosed){this.socket=socket;this.onPacket=onPacket;this.onClosed=onClosed;this.buffer=Buffer.alloc(0);this.alive=true;this.closed=false;this.clientId=null;this.window=Date.now();this.rate=0;this.lastCursorAt=0;this.lastCameraAt=0;this.lastStatusAt=0;this.activity='exploring';this.pingMs=null;this.pose=null;this.graceful=false;
  this.reliableQueue=[];this.queuedBytes=0;this.nextFragmentId=0;this.inboundFragment=null;
  socket.on('data',chunk=>this.feed(chunk));socket.on('drain',()=>this.flushReliable());socket.on('error',()=>this.finish());socket.on('close',()=>this.finish());}
 finish(){if(this.closed)return;this.closed=true;this.reliableQueue.length=0;this.queuedBytes=0;this.onClosed(this);}
 close(){if(this.closed)return;this.socket.end(this.makeFrame(8,Buffer.alloc(0)));this.socket.destroy();this.finish()}
 makeFrame(op,bytes){const length=bytes.length;const header=length<126?2:length<65536?4:10;const buffer=Buffer.allocUnsafe(header+length);buffer[0]=0x80|op;if(header===2)buffer[1]=length;else if(header===4){buffer[1]=126;buffer.writeUInt16BE(length,2)}else{buffer[1]=127;buffer.writeBigUInt64BE(BigInt(length),2)}bytes.copy(buffer,header);return buffer}
 flushReliable(){
  if(this.closed||!this.socket.writable)return;
  while(this.reliableQueue.length&&!this.socket.writableNeedDrain&&this.socket.writableLength<SOCKET_BUFFER_TARGET){
   const frame=this.reliableQueue.shift();this.queuedBytes-=frame.length;
   // A false return means Node has buffered the frame; wait for `drain`.
   if(!this.socket.write(frame))break;
  }
 }
 enqueueReliable(frames){
  const total=frames.reduce((n,frame)=>n+frame.length,0);
  if(this.queuedBytes+total>RELIABLE_QUEUE_MAX){
   console.warn('BuildTogether: slow participant exceeded the 40 MiB reliable queue; map preserved on host.');
   this.close();return;
  }
  this.reliableQueue.push(...frames);this.queuedBytes+=total;this.flushReliable();
 }
 send(message){if(this.closed||!this.socket.writable)return;
  const ephemeral=message.type==='cursor'||message.type==='camera'||message.type==='member-status';
  if(ephemeral&&(this.reliableQueue.length||this.socket.writableNeedDrain||this.socket.writableLength>SOCKET_BUFFER_TARGET))return;
  const body=Buffer.from(JSON.stringify(message));
  if(body.length>=LIMIT){if(!ephemeral)this.close();return;}
  if(!ephemeral&&this.protocol>=4&&body.length>FRAGMENT_THRESHOLD){
   const id=`s${++this.nextFragmentId}`,total=Math.ceil(body.length/FRAGMENT_BYTES);
   const frames=[];
   for(let index=0;index<total;index++){
    const part=body.subarray(index*FRAGMENT_BYTES,(index+1)*FRAGMENT_BYTES);
    const fragment=Buffer.from(JSON.stringify({type:'fragment',id,index,total,data:part.toString('base64')}));
    frames.push(this.makeFrame(1,fragment));
   }
   return this.enqueueReliable(frames);
  }
  const frame=this.makeFrame(1,body);
  if(ephemeral){this.socket.write(frame);return;}
  this.enqueueReliable([frame]);
 }
 acceptMessage(value){
  if(value?.type!=='fragment'){this.onPacket(this,value);return;}
  // The v4 stream is intentionally sequential. A fragment cannot alter the
  // authoritative map until its entire JSON transaction is verified.
  if(this.protocol!==4||!this.clientId||typeof value.id!=='string'||!/^[a-zA-Z0-9_-]{1,48}$/.test(value.id)||
   !Number.isInteger(value.index)||!Number.isInteger(value.total)||value.total<2||value.total>MAX_FRAGMENTS||
   typeof value.data!=='string'||value.data.length>24000||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.data))return this.close();
  const part=Buffer.from(value.data,'base64');
  if(!part.length||part.length>FRAGMENT_BYTES)return this.close();
  const now=Date.now();
  if(!this.inboundFragment){
   if(value.index!==0)return this.close();
   this.inboundFragment={id:value.id,total:value.total,next:0,bytes:0,parts:[],deadline:now+60000};
  }
  const work=this.inboundFragment;
  if(now>work.deadline||work.id!==value.id||work.total!==value.total||value.index!==work.next||work.bytes+part.length>=LIMIT)return this.close();
  work.parts.push(part);work.bytes+=part.length;work.next++;
  if(work.next===work.total){
   this.inboundFragment=null;
   let full;try{full=JSON.parse(Buffer.concat(work.parts,work.bytes).toString('utf8'))}catch{return this.close()}
   if(!full||typeof full!=='object'||full.type==='fragment')return this.close();
   this.onPacket(this,full);
  }
 }
 feed(chunk){if(this.closed)return;if(this.buffer.length+chunk.length>LIMIT+256)return this.close();this.buffer=Buffer.concat([this.buffer,chunk]);while(this.buffer.length>=2){const first=this.buffer[0],second=this.buffer[1],op=first&15,masked=!!(second&128);let len=second&127,offset=2;if(!(first&0x80)||!masked)return this.close();if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);offset=4}else if(len===127){if(this.buffer.length<10)return;const big=this.buffer.readBigUInt64BE(2);if(big>BigInt(LIMIT))return this.close();len=Number(big);offset=10}if(len>LIMIT)return this.close();if(this.buffer.length<offset+4+len)return;const key=this.buffer.subarray(offset,offset+4),body=Buffer.from(this.buffer.subarray(offset+4,offset+4+len));this.buffer=this.buffer.subarray(offset+4+len);for(let i=0;i<body.length;i++)body[i]^=key[i%4];if(op===8)return this.close();if(op===9){this.socket.write(this.makeFrame(10,body));continue}if(op===10){this.alive=true;continue}if(op!==1)return this.close();const now=Date.now();if(now-this.window>1000){this.window=now;this.rate=0}if(++this.rate>90)return this.close();let value;try{value=JSON.parse(body.toString('utf8'))}catch{return this.close()}this.acceptMessage(value);}}
}
export function attachBuildTogether(app,{port=49178,listen=process.env.SVEN_BUILDTOGETHER_LISTEN==='0.0.0.0'?'0.0.0.0':'127.0.0.1'}={}){
 let room=null;const COLORS=['#50b5ff','#ffab65','#71e5b2','#d1a2ff','#ffe377','#ff839f'];
 const peers=new Set();let hostGraceTimer=null;
 const endRoom=(reason)=>{const old=room;room=null;clearTimeout(hostGraceTimer);hostGraceTimer=null;if(!old)return;for(const peer of [...old.peers]){peer.send({type:'closed',reason});peer.close()}};
 const peersToKeep=()=>room&&[...room.peers].some(p=>p.role==='host');
 const members=()=>room?[...room.peers].filter(p=>p.clientId).map(p=>({id:p.clientId,name:p.name,color:p.color,role:p.role,selection:p.selection||[],activity:p.activity||'exploring',pingMs:p.pingMs??null})):[];
 const broadcast=msg=>{if(room)for(const peer of room.peers)peer.send(msg)};
 const snapshot=()=>({type:'snapshot',project:room.project,revision:room.revision,participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner})),cameras:Object.fromEntries([...room.peers].filter(p=>p.clientId&&p.pose).map(p=>[p.clientId,p.pose]))});
 const release=peer=>{if(!room)return;for(const [id,owner] of room.locks)if(owner===peer.clientId)room.locks.delete(id)};
 const cleanup=peer=>{
  peers.delete(peer);if(!room||!room.peers.has(peer))return;
  room.peers.delete(peer);release(peer);
  if(peer.role==='host'){
   if(peer.graceful)return endRoom('The host ended the session.');
   // Temporary connection loss must not destroy the whole collaborative map.
   // Other participants can continue editing; the host can resume within 45s.
   if(!peersToKeep()){const original=room;clearTimeout(hostGraceTimer);hostGraceTimer=setTimeout(()=>{if(room===original&&!peersToKeep())endRoom('Host reconnection window expired.')},HOST_RECONNECT_GRACE_MS);hostGraceTimer.unref?.()}
  }
  broadcast({type:'presence',participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner}))});
 };
 const packet=(peer,msg)=>{
  if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
  if(!peer.clientId){
   if(msg.type!=='join'||!room||(!safeToken(msg.code,room.code)&&!safeToken(msg.hostKey,room.hostKey)))return peer.close();
   if(room.peers.size>=6)return peer.close();
   const isHost=safeToken(msg.hostKey,room.hostKey);
   if(isHost&&peersToKeep())return peer.close(); // Prevent duplicate hosts.
   const now=Date.now();for(const [key,entry] of room.sessions)if(now-entry.time>PEER_SESSION_TTL_MS)room.sessions.delete(key);
   const resume=typeof msg.resumeKey==='string'?room.sessions.get(msg.resumeKey):null;
   const restored=resume&&(isHost||resume.role!=='host')?resume:null;
   peer.clientId=restored?.id||randomId();
   peer.resumeKey=restored?.key||TOKEN();
   peer.name=String(msg.name||'Mapper').trim().slice(0,28).replace(/[<>]/g,'')||'Mapper';
   peer.color=restored?.color||COLORS[room.peers.size%COLORS.length];
   peer.role=isHost?'host':msg.spectator===true?'spectator':'editor';peer.protocol=msg.protocol===4?4:msg.protocol===3?3:2;
   peer.selection=[];peer.activity='exploring';peer.pingMs=null;peer.pose=null;
   room.sessions.set(peer.resumeKey,{key:peer.resumeKey,id:peer.clientId,color:peer.color,role:peer.role,time:now});
   room.peers.add(peer);if(isHost){clearTimeout(hostGraceTimer);hostGraceTimer=null}
   peer.send({...snapshot(),selfId:peer.clientId,role:peer.role,resumeKey:peer.resumeKey});
   broadcast({type:'presence',participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner}))});return;
  }
  if(!room||!room.peers.has(peer))return peer.close();
  if(msg.type==='leave'){peer.graceful=true;return peer.close()}
  if(msg.type==='ping'){if(Number.isSafeInteger(msg.nonce)&&msg.nonce>=0)peer.send({type:'pong',nonce:msg.nonce});return}
  if(msg.type==='member-status'){
   // Presence is lossy, bounded and independent of map revision or edit locks.
   const now=Date.now();if(now-peer.lastStatusAt<350||peer.protocol<3)return;
   if(!STATUS_CODES.has(msg.activity)||!(msg.pingMs===null||(Number.isInteger(msg.pingMs)&&msg.pingMs>=0&&msg.pingMs<=60000)))return;
   peer.lastStatusAt=now;
   const changed=peer.activity!==msg.activity||peer.pingMs!==msg.pingMs;peer.activity=msg.activity;peer.pingMs=msg.pingMs;
   if(changed)for(const other of room.peers)if(other!==peer)other.send({type:'member-status',id:peer.clientId,activity:peer.activity,pingMs:peer.pingMs});
   return;
  }
  if(msg.type==='cursor'){const now=Date.now();if(now-peer.lastCursorAt<45)return;peer.lastCursorAt=now;if(Number.isFinite(msg.x)&&Number.isFinite(msg.y))for(const other of room.peers)if(other!==peer)other.send({type:'cursor',id:peer.clientId,x:Math.min(1,Math.max(0,msg.x)),y:Math.min(1,Math.max(0,msg.y))});return;}
  if(msg.type==='camera'){const now=Date.now();if(now-peer.lastCameraAt<90)return;peer.lastCameraAt=now;const pose=msg.pose;if(pose&&['perspective','orthographic'].includes(pose.projection)&&[pose.position,pose.target,pose.up].every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<2000000))&&pose.up.some(n=>Math.abs(n)>.001)&&Number.isFinite(pose.orthoHeight)&&pose.orthoHeight>0&&pose.orthoHeight<300000&&(pose.fov===undefined||Number.isFinite(pose.fov)&&pose.fov>=10&&pose.fov<=140)&&(pose.aspect===undefined||Number.isFinite(pose.aspect)&&pose.aspect>=.2&&pose.aspect<=6)){
   // Keep only numeric camera fields; never replicate arbitrary client data.
   peer.pose={projection:pose.projection,position:pose.position.slice(0,3),target:pose.target.slice(0,3),up:pose.up.slice(0,3),orthoHeight:pose.orthoHeight,
    ...(pose.fov===undefined?{}:{fov:pose.fov}),...(pose.aspect===undefined?{}:{aspect:pose.aspect})};
   for(const other of room.peers)if(other!==peer)other.send({type:'camera',id:peer.clientId,pose:peer.pose});
  }return;}
  if(msg.type==='selection'){const list=Array.isArray(msg.ids)?msg.ids.filter(id=>typeof id==='string').slice(0,80):[];peer.selection=list;if(peer.role!=='spectator'){release(peer);for(const id of list)if(room.project.objects.some(o=>o.id===id)&&!room.locks.has(id))room.locks.set(id,peer.clientId);}broadcast({type:'presence',participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner}))});return;}
  if(msg.type==='release'){release(peer);broadcast({type:'presence',participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner}))});return;}
  if(msg.type!=='change'||peer.role==='spectator')return;
  const ops=msg.ops,base=msg.base;
  if(!Array.isArray(ops)||(!ops.length&&msg.meta===undefined&&msg.metaPatch===undefined)||ops.length>MAX_CHANGE_OBJECTS||!Number.isSafeInteger(base)||base<0||base>room.revision||msg.meta!==undefined&&msg.metaPatch!==undefined)
   return peer.send({...snapshot(),type:'rejected',reason:'Invalid change batch'});
  const seen=new Set();for(const op of ops){if(!op||!['put','delete'].includes(op.kind)||typeof op.id!=='string'||op.id.length>140||seen.has(op.id)||(op.kind==='put'&&(!validObject(op.object)||op.object.id!==op.id)))return peer.send({...snapshot(),type:'rejected',reason:'Invalid object update'});seen.add(op.id);if(room.locks.has(op.id)&&room.locks.get(op.id)!==peer.clientId)return peer.send({...snapshot(),type:'rejected',reason:'Object is locked by another participant'});if((room.objectRevision.get(op.id)||0)>base&&room.objectAuthor.get(op.id)!==peer.clientId)return peer.send({...snapshot(),type:'rejected',reason:'Object changed by another participant'});}
  const existing=new Map(room.project.objects.map(o=>[o.id,o]));for(const op of ops){if(op.kind==='delete')existing.delete(op.id);else existing.set(op.id,deep(op.object));}if(existing.size>25000)return peer.send({...snapshot(),type:'rejected',reason:'Map object limit reached'});
  // v3/v4 updates only the changed studio metadata keys; v2 full snapshots are
  // still accepted, but cannot overwrite newer metadata from another editor.
  const old=room.project;
  let patch;
  if(msg.metaPatch!==undefined){
   if(peer.protocol<3||!validPatch(msg.metaPatch))return peer.send({...snapshot(),type:'rejected',reason:'Invalid studio metadata patch'});
   patch=deep(msg.metaPatch);
   for(const key of [...Object.keys(patch.set),...patch.unset]){
    if((room.metaKeyRevision.get(key)||0)>base&&room.metaKeyAuthor.get(key)!==peer.clientId)
     return peer.send({...snapshot(),type:'rejected',reason:`Studio metadata conflict: ${key}`});
   }
  }else if(msg.meta!==undefined){
   if(base<room.metaRevision&&room.metaAuthor!==peer.clientId)return peer.send({...snapshot(),type:'rejected',reason:'World settings changed by another participant'});
   const meta=msg.meta;
   if(!meta||typeof meta!=='object'||Array.isArray(meta)||Object.keys(meta).some(key=>!META_FIELDS.has(key)&&key!=='version')||meta.version!==1||typeof meta.name!=='string'||!Array.isArray(meta.wadNames)||!meta.world||typeof meta.world!=='object')return peer.send({...snapshot(),type:'rejected',reason:'Invalid map settings'});
   patch=metadataDiff(old,{version:1,...meta});
  }
  const next=patch?applyMetadataPatch(old,patch):old;
  const project={...next,objects:[...existing.values()]};
  if(!validSharedProject(project)||!validStudioMetadata(project))return peer.send({...snapshot(),type:'rejected',reason:'Invalid shared map after change'});
  const actual=patch?metadataDiff(old,project):undefined;
  const metaKeys=actual?[...Object.keys(actual.set),...actual.unset]:[];
  room.project=project;room.revision++;
  for(const op of ops){room.objectRevision.set(op.id,room.revision);room.objectAuthor.set(op.id,peer.clientId)}
  for(const key of metaKeys){room.metaKeyRevision.set(key,room.revision);room.metaKeyAuthor.set(key,peer.clientId)}
  if(metaKeys.length){room.metaRevision=room.revision;room.metaAuthor=peer.clientId}
  // Protocol negotiation keeps v2 participants running during rolling upgrades.
  // v2 receives a complete metadata snapshot; v3 receives only changed keys.
  for(const other of room.peers){
   other.send({type:'change',revision:room.revision,author:peer.clientId,ops,
    ...(metaKeys.length?(other.protocol>=3?{metaPatch:actual}:{meta:metaFromProject(project)}):{})});
  }
 };
 app.post('/api/buildtogether/create',(req,res)=>{
  if(room?.peers.size===0){clearTimeout(hostGraceTimer);hostGraceTimer=null;room=null;} // A local user may explicitly start a new room if no peers remain.
  if(room)return res.status(409).json({error:'A BuildTogether session already exists on this PC. End it first.'});
  const project=req.body?.project;if(!validSharedProject(project)||!validStudioMetadata(project))return res.status(400).json({error:'Invalid map project.'});
  room={code:TOKEN(),hostKey:TOKEN(),project:deep(project),revision:0,metaRevision:0,metaAuthor:'',metaKeyRevision:new Map(),metaKeyAuthor:new Map(),objectRevision:new Map(),objectAuthor:new Map(),locks:new Map(),peers:new Set(),sessions:new Map()};
  res.set('Cache-Control','no-store').json({code:room.code,hostKey:room.hostKey,port,listen,warning:listen==='127.0.0.1'?'LAN access is disabled until SVEN_BUILDTOGETHER_LISTEN=0.0.0.0 is set.':''});
 });
 const server=http.createServer((_req,res)=>{res.writeHead(404);res.end('BuildTogether WebSocket only');});
 server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/buildtogether'||String(req.headers.upgrade||'').toLowerCase()!=='websocket'||!String(req.headers['sec-websocket-version']||'').includes('13')||typeof req.headers['sec-websocket-key']!=='string'){socket.destroy();return}
  if(peers.size>8){socket.destroy();return}
  const key=req.headers['sec-websocket-key'];let valid=false;try{valid=Buffer.from(key,'base64').length===16}catch{}if(!valid){socket.destroy();return}
  const accept=createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const peer=new Peer(socket,packet,cleanup);peers.add(peer);if(head.length)peer.feed(head);setTimeout(()=>{if(!peer.clientId)peer.close()},8000).unref();
 });
 const timer=setInterval(()=>{for(const p of peers){if(!p.alive){p.close();continue}p.alive=false;p.socket.write(p.makeFrame(9,Buffer.alloc(0)))}},25000);timer.unref();
 server.listen(port,listen,()=>console.log(`BuildTogether collaboration service: ws://${listen}:${port}/buildtogether`));
 return {server,hasRoom:()=>Boolean(room),closeRoom:()=>endRoom('Server shutdown')};
}
