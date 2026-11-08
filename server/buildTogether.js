/** BuildTogether: isolated, authenticated WebSocket relay for map edits.
 * This service NEVER reads files, compiles, or shares local SDK/game settings.
 * Only the explicitly shared Project is synchronized. Node 22+, no deps.
 */
import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const LIMIT=12*1024*1024;
const TOKEN=()=>randomBytes(18).toString('hex');
const HOST_RECONNECT_GRACE_MS=45000;
const PEER_SESSION_TTL_MS=90000;
const randomId=()=>randomBytes(8).toString('hex');
const validObject=o=>o&&typeof o==='object'&&!Array.isArray(o)&&typeof o.id==='string'&&o.id.length>0&&o.id.length<=140&&(o.kind==='brush'||o.kind==='entity')&&Array.isArray(o.position)&&o.position.length===3&&o.position.every(v=>Number.isFinite(v)&&Math.abs(v)<10000000);
export function validSharedProject(p){return Boolean(p&&typeof p==='object'&&p.version===1&&typeof p.name==='string'&&p.name.length<256&&Array.isArray(p.objects)&&p.objects.length<=25000&&p.objects.every(validObject)&&new Set(p.objects.map(o=>o.id)).size===p.objects.length&&p.world&&typeof p.world==='object'&&!Array.isArray(p.world)&&Array.isArray(p.wadNames)&&p.wadNames.length<500);}
const deep=v=>JSON.parse(JSON.stringify(v));
const safeToken=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)};
class Peer{
 constructor(socket,onPacket,onClosed){this.socket=socket;this.onPacket=onPacket;this.onClosed=onClosed;this.buffer=Buffer.alloc(0);this.alive=true;this.closed=false;this.clientId=null;this.window=Date.now();this.rate=0;this.lastCursorAt=0;this.lastCameraAt=0;this.graceful=false;
  socket.on('data',chunk=>this.feed(chunk));socket.on('error',()=>this.finish());socket.on('close',()=>this.finish());}
 finish(){if(this.closed)return;this.closed=true;this.onClosed(this);}
 close(){if(this.closed)return;this.socket.end(this.makeFrame(8,Buffer.alloc(0)));this.socket.destroy();this.finish()}
 makeFrame(op,bytes){const length=bytes.length;const header=length<126?2:length<65536?4:10;const buffer=Buffer.allocUnsafe(header+length);buffer[0]=0x80|op;if(header===2)buffer[1]=length;else if(header===4){buffer[1]=126;buffer.writeUInt16BE(length,2)}else{buffer[1]=127;buffer.writeBigUInt64BE(BigInt(length),2)}bytes.copy(buffer,header);return buffer}
 send(message){if(this.closed||!this.socket.writable)return;
  // Unreliable presence streams may be dropped under backpressure. Map edits may not.
  const ephemeral=message.type==='cursor'||message.type==='camera';
  if(ephemeral&&this.socket.writableLength>256*1024)return;
  if(!ephemeral&&this.socket.writableLength>4*1024*1024)return this.close();
  const body=Buffer.from(JSON.stringify(message));if(body.length<LIMIT)this.socket.write(this.makeFrame(1,body));}
 feed(chunk){if(this.closed)return;if(this.buffer.length+chunk.length>LIMIT+256)return this.close();this.buffer=Buffer.concat([this.buffer,chunk]);while(this.buffer.length>=2){const first=this.buffer[0],second=this.buffer[1],op=first&15,masked=!!(second&128);let len=second&127,offset=2;if(!(first&0x80)||!masked)return this.close();if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);offset=4}else if(len===127){if(this.buffer.length<10)return;const big=this.buffer.readBigUInt64BE(2);if(big>BigInt(LIMIT))return this.close();len=Number(big);offset=10}if(len>LIMIT)return this.close();if(this.buffer.length<offset+4+len)return;const key=this.buffer.subarray(offset,offset+4),body=Buffer.from(this.buffer.subarray(offset+4,offset+4+len));this.buffer=this.buffer.subarray(offset+4+len);for(let i=0;i<body.length;i++)body[i]^=key[i%4];if(op===8)return this.close();if(op===9){this.socket.write(this.makeFrame(10,body));continue}if(op===10){this.alive=true;continue}if(op!==1)return this.close();const now=Date.now();if(now-this.window>1000){this.window=now;this.rate=0}if(++this.rate>90)return this.close();let value;try{value=JSON.parse(body.toString('utf8'))}catch{return this.close()}this.onPacket(this,value);}}
}
export function attachBuildTogether(app,{port=49178,listen=process.env.SVEN_BUILDTOGETHER_LISTEN==='0.0.0.0'?'0.0.0.0':'127.0.0.1'}={}){
 let room=null;const COLORS=['#50b5ff','#ffab65','#71e5b2','#d1a2ff','#ffe377','#ff839f'];
 const peers=new Set();let hostGraceTimer=null;
 const endRoom=(reason)=>{const old=room;room=null;clearTimeout(hostGraceTimer);hostGraceTimer=null;if(!old)return;for(const peer of [...old.peers]){peer.send({type:'closed',reason});peer.close()}};
 const peersToKeep=()=>room&&[...room.peers].some(p=>p.role==='host');
 const members=()=>room?[...room.peers].filter(p=>p.clientId).map(p=>({id:p.clientId,name:p.name,color:p.color,role:p.role,selection:p.selection||[]})):[];
 const broadcast=msg=>{if(room)for(const peer of room.peers)peer.send(msg)};
 const snapshot=()=>({type:'snapshot',project:room.project,revision:room.revision,participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner}))});
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
   peer.role=isHost?'host':msg.spectator===true?'spectator':'editor';
   peer.selection=[];
   room.sessions.set(peer.resumeKey,{key:peer.resumeKey,id:peer.clientId,color:peer.color,role:peer.role,time:now});
   room.peers.add(peer);if(isHost){clearTimeout(hostGraceTimer);hostGraceTimer=null}
   peer.send({...snapshot(),selfId:peer.clientId,role:peer.role,resumeKey:peer.resumeKey});
   broadcast({type:'presence',participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner}))});return;
  }
  if(!room||!room.peers.has(peer))return peer.close();
  if(msg.type==='leave'){peer.graceful=true;return peer.close()}
  if(msg.type==='ping'){if(Number.isSafeInteger(msg.nonce)&&msg.nonce>=0)peer.send({type:'pong',nonce:msg.nonce});return}
  if(msg.type==='cursor'){const now=Date.now();if(now-peer.lastCursorAt<45)return;peer.lastCursorAt=now;if(Number.isFinite(msg.x)&&Number.isFinite(msg.y))for(const other of room.peers)if(other!==peer)other.send({type:'cursor',id:peer.clientId,x:Math.min(1,Math.max(0,msg.x)),y:Math.min(1,Math.max(0,msg.y))});return;}
  if(msg.type==='camera'){const now=Date.now();if(now-peer.lastCameraAt<90)return;peer.lastCameraAt=now;const pose=msg.pose;if(pose&&['perspective','orthographic'].includes(pose.projection)&&[pose.position,pose.target,pose.up].every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<2000000))&&Number.isFinite(pose.orthoHeight)&&pose.orthoHeight>0&&pose.orthoHeight<300000)for(const other of room.peers)if(other!==peer)other.send({type:'camera',id:peer.clientId,pose});return;}
  if(msg.type==='selection'){const list=Array.isArray(msg.ids)?msg.ids.filter(id=>typeof id==='string').slice(0,80):[];peer.selection=list;if(peer.role!=='spectator'){release(peer);for(const id of list)if(room.project.objects.some(o=>o.id===id)&&!room.locks.has(id))room.locks.set(id,peer.clientId);}broadcast({type:'presence',participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner}))});return;}
  if(msg.type==='release'){release(peer);broadcast({type:'presence',participants:members(),locks:[...room.locks].map(([id,owner])=>({id,owner}))});return;}
  if(msg.type!=='change'||peer.role==='spectator')return;
  const ops=msg.ops,base=msg.base;if(!Array.isArray(ops)||(!ops.length&&msg.meta===undefined)||ops.length>256||!Number.isSafeInteger(base)||base<0||base>room.revision)return peer.send({...snapshot(),type:'rejected',reason:'Invalid change batch'});
  const seen=new Set();for(const op of ops){if(!op||!['put','delete'].includes(op.kind)||typeof op.id!=='string'||op.id.length>140||seen.has(op.id)||(op.kind==='put'&&(!validObject(op.object)||op.object.id!==op.id)))return peer.send({...snapshot(),type:'rejected',reason:'Invalid object update'});seen.add(op.id);if(room.locks.has(op.id)&&room.locks.get(op.id)!==peer.clientId)return peer.send({...snapshot(),type:'rejected',reason:'Object is locked by another participant'});if((room.objectRevision.get(op.id)||0)>base&&room.objectAuthor.get(op.id)!==peer.clientId)return peer.send({...snapshot(),type:'rejected',reason:'Object changed by another participant'});}
  const existing=new Map(room.project.objects.map(o=>[o.id,o]));for(const op of ops){if(op.kind==='delete')existing.delete(op.id);else existing.set(op.id,deep(op.object));}if(existing.size>25000)return peer.send({...snapshot(),type:'rejected',reason:'Map object limit reached'});
  const meta=msg.meta;if(meta!==undefined){if(base<room.metaRevision&&room.metaAuthor!==peer.clientId)return peer.send({...snapshot(),type:'rejected',reason:'World settings changed by another participant'});if(!meta||typeof meta!=='object'||Array.isArray(meta)||typeof meta.name!=='string'||meta.name.length>255||!Array.isArray(meta.wadNames)||!meta.world||typeof meta.world!=='object')return peer.send({...snapshot(),type:'rejected',reason:'Invalid map settings'});}
  room.project={...room.project,objects:[...existing.values()],...(meta?deep(meta):{})};room.revision++;for(const op of ops){room.objectRevision.set(op.id,room.revision);room.objectAuthor.set(op.id,peer.clientId)}if(meta){room.metaRevision=room.revision;room.metaAuthor=peer.clientId}broadcast({type:'change',revision:room.revision,author:peer.clientId,ops,meta:meta||null});
 };
 app.post('/api/buildtogether/create',(req,res)=>{
  if(room?.peers.size===0){clearTimeout(hostGraceTimer);hostGraceTimer=null;room=null;} // A local user may explicitly start a new room if no peers remain.
  if(room)return res.status(409).json({error:'A BuildTogether session already exists on this PC. End it first.'});
  const project=req.body?.project;if(!validSharedProject(project))return res.status(400).json({error:'Invalid map project.'});
  room={code:TOKEN(),hostKey:TOKEN(),project:deep(project),revision:0,metaRevision:0,metaAuthor:'',objectRevision:new Map(),objectAuthor:new Map(),locks:new Map(),peers:new Set(),sessions:new Map()};
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
