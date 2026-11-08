/** BuildTogether 2.0. Only Project objects and world metadata are shared.
 * SDK paths, imported WAD binaries, compiler settings and local files stay private.
 * Edits are serialized against server acknowledgements; presence packets are lossy.
 */
import {create} from 'zustand';
import {useEditor} from '../store';
import type {MapObject,Project} from './types';
export type Member={id:string;name:string;color:string;role:'host'|'editor'|'spectator';selection:string[]};
export type Lock={id:string;owner:string};
export type RemoteCursor={id:string;x:number;y:number};
export type CameraPose={projection:'perspective'|'orthographic';position:[number,number,number];target:[number,number,number];up:[number,number,number];orthoHeight:number};
type Status='offline'|'connecting'|'reconnecting'|'online';
type CollaborationState={hasRecoveryBackup:boolean;status:Status;server:string;code:string;role:string;selfId:string;participants:Member[];locks:Lock[];cursors:Record<string,RemoteCursor>;cameras:Record<string,CameraPose>;followId:string|null;revision:number;error:string;host:boolean;remoteName:string;pingMs:number|null;jitterMs:number|null;reconnectAttempt:number;pendingChanges:number;lastSyncAt:number};
const savedBackup=()=>{try{return Boolean(sessionStorage.getItem('svenstudio:buildtogether-disconnected-backup'));}catch{return false;}};
const initial:CollaborationState={hasRecoveryBackup:savedBackup(),status:'offline',server:'127.0.0.1:49178',code:'',role:'',selfId:'',participants:[],locks:[],cursors:{},cameras:{},followId:null,revision:0,error:'',host:false,remoteName:'',pingMs:null,jitterMs:null,reconnectAttempt:0,pendingChanges:0,lastSyncAt:0};
export const useBuildTogether=create<CollaborationState>(()=>initial);
type ChangeOp={kind:'put'|'delete';id:string;object?:MapObject};
type Session={url:string;address:string;code:string;name:string;hostKey:string;resumeKey:string;spectator:boolean};
let session:Session|null=null;
let connection:WebSocket|null=null;
let unlisten:(()=>void)|null=null;
let latestProject:Project|null=null;
let applying=false;
let inFlight=false;
let changeSentAt=0;
let dirty=false;
let offlineEdits=false;
let generation=0;
let flushTimer:ReturnType<typeof setTimeout>|null=null;
let retryTimer:ReturnType<typeof setTimeout>|null=null;
let pingTimer:ReturnType<typeof setInterval>|null=null;
let lastCursorAt=0,lastCameraAt=0,lastSelection='',lastCameraSignature='';
let pingNonce=0,pingSentAt=0,awaitingPong=false;
const copy=<T,>(value:T):T=>structuredClone(value);
const backupKey='svenstudio:buildtogether-disconnected-backup';
function normalizedEndpoint(input:string){
 const raw=input.trim().replace(/^https?:\/\//i,'').replace(/^wss?:\/\//i,'').replace(/\/.*$/,'');
 if(!/^(?:\[[a-f\d:]+\]|[a-z\d.-]+)(?::\d{1,5})?$/i.test(raw))throw Error('Enter a server address, such as 192.168.1.10:49178.');
 const host=raw.includes(':')?raw:raw+':49178';
 return `${location.protocol==='https:'?'wss':'ws'}://${host}/buildtogether`;
}
function metadata(project:Project){const {objects:_objects,...meta}=project;return meta;}
function mapOp(project:Project,ops:ChangeOp[],meta?:Partial<Project>){
 const items=new Map(project.objects.map(o=>[o.id,o]));
 for(const op of ops){if(op.kind==='delete')items.delete(op.id);else if(op.object)items.set(op.id,copy(op.object));}
 return {...project,...meta,objects:[...items.values()]};
}
function changes(before:Project,after:Project):{ops:ChangeOp[];meta?:Partial<Project>}{
 const oldMap=new Map(before.objects.map(o=>[o.id,o]));const nextMap=new Map(after.objects.map(o=>[o.id,o]));
 const ops:ChangeOp[]=[];
 for(const [id,object] of nextMap){const previous=oldMap.get(id);if(!previous||previous!==object&&JSON.stringify(previous)!==JSON.stringify(object))ops.push({kind:'put',id,object});}
 for(const id of oldMap.keys())if(!nextMap.has(id))ops.push({kind:'delete',id});
 const previousMeta=metadata(before),nextMeta=metadata(after);
 return {ops,meta:JSON.stringify(previousMeta)===JSON.stringify(nextMeta)?undefined:nextMeta};
}
function notifyError(reason:string){useBuildTogether.setState({error:reason});useEditor.getState().appendLogs(['BuildTogether: '+reason]);}
function send(value:object,ephemeral=false){
 const socket=connection;if(!socket||socket.readyState!==WebSocket.OPEN)return false;
 // Don't allow cursor/camera samples to delay authoritative geometry messages.
 if(ephemeral&&socket.bufferedAmount>128*1024)return false;
 const serialized=JSON.stringify(value);
 // Server WebSocket packets have a 12 MiB hard limit. Do not silently lose a
 // bulk studio operation while waiting for a server acknowledgement that will
 // never arrive (for example very large embedded custom NPC metadata).
 if(new TextEncoder().encode(serialized).byteLength>=8*1024*1024){
  if(!ephemeral)backupEdits('The change packet exceeds the safe BuildTogether limit (8 MiB).');
  return false;
 }
 socket.send(serialized);return true;
}
function rebaseHistory(projects:Project[],ops:ChangeOp[],meta?:Partial<Project>){return projects.map(project=>mapOp(project,ops,meta));}
function replaceAuthoritative(project:Project){
 applying=true;
 try{
  latestProject=copy(project);
  const ids=new Set(project.objects.map(o=>o.id));
  useEditor.setState(state=>({project:copy(project),selected:state.selected&&ids.has(state.selected)?state.selected:null,
   selectedIds:state.selectedIds.filter(id=>ids.has(id)),history:[],future:[]}));
 }finally{applying=false;}
}
function acceptIncoming(ops:ChangeOp[],meta?:Partial<Project>){
 applying=true;
 try{
  const base=latestProject;
  // Preserve local unacknowledged changes when a teammate edits concurrently.
  // Before this fix a remote world/terrain metadata update could overwrite an
  // in-flight terrain group on the local client, making generated tools vanish.
  const local=useEditor.getState().project;
  const pending=base?changes(base,local):{ops:[] as ChangeOp[],meta:undefined};
  const remoteIds=new Set(ops.map(op=>op.id));
  const localOps=pending.ops.filter(op=>!remoteIds.has(op.id));
  // Local metadata is a complete project-metadata snapshot. Retain changed
  // keys only; unrelated remote world/architecture changes still arrive.
  const localMeta:Record<string,unknown>={};
  if(base){
   const before=metadata(base) as Record<string,unknown>;
   const now=metadata(local) as Record<string,unknown>;
   for(const key of new Set([...Object.keys(before),...Object.keys(now)])){
    if(JSON.stringify(before[key])!==JSON.stringify(now[key]))localMeta[key]=now[key];
   }
  }
  if(base)latestProject=mapOp(base,ops,meta);
  useEditor.setState(state=>({
   project:{...mapOp(mapOp(state.project,ops,meta),localOps),...localMeta},
   history:rebaseHistory(state.history,ops,meta),future:rebaseHistory(state.future,ops,meta)
  }));
  if(localOps.length||Object.keys(localMeta).length){dirty=true;scheduleFlush(0);}
 }finally{applying=false;}
}
function backupEdits(message:string){
 try{sessionStorage.setItem(backupKey,JSON.stringify(useEditor.getState().project));
  useBuildTogether.setState({hasRecoveryBackup:true});
  notifyError(`${message} A copy of your local map was saved in this browser's session storage (${backupKey}).`);
 }catch{notifyError(`${message} Save your project manually before leaving this page.`);}
}
function cancelFlush(){if(flushTimer!==null){clearTimeout(flushTimer);flushTimer=null;}}
function scheduleFlush(delay=useEditor.getState().project.objects.length>2000?110:65){if(flushTimer!==null||!session||useBuildTogether.getState().status!=='online')return;
 flushTimer=setTimeout(()=>{flushTimer=null;flushChanges();},delay);
}
function flushChanges(){
 if(inFlight||!latestProject||connection?.readyState!==WebSocket.OPEN||useBuildTogether.getState().status!=='online')return;
 const room=useBuildTogether.getState();if(room.role==='spectator')return;
 const delta=changes(latestProject,useEditor.getState().project);
 if(!delta.ops.length&&!delta.meta){dirty=false;useBuildTogether.setState({pendingChanges:0});return;}
 if(useEditor.getState().project.objects.length>25000){backupEdits('BuildTogether supports at most 25,000 map objects.');replaceAuthoritative(latestProject);return;}
 const foreignLocks=new Set(room.locks.filter(lock=>lock.owner!==room.selfId).map(lock=>lock.id));
 if(delta.ops.some(op=>foreignLocks.has(op.id))){backupEdits('Another mapper owns an edited object.');replaceAuthoritative(latestProject);return;}
 // Large operations such as Terrain/Architecture must transfer all brushes
 // before publishing provenance metadata. This prevents remote clients from
 // seeing a terrain group whose brushIds have not reached the server yet.
 const ops=delta.ops.slice(0,128);
 const finalBatch=delta.ops.length<=ops.length;
 const meta=finalBatch?delta.meta:undefined;
 if(send({type:'change',base:room.revision,ops,...(meta?{meta}:{})})){
  inFlight=true;changeSentAt=Date.now();dirty=false;useBuildTogether.setState({pendingChanges:delta.ops.length+(delta.meta?1:0)});
 }
}
function beginSubscription(){
 unlisten?.();lastSelection=JSON.stringify(useEditor.getState().selectedIds);
 unlisten=useEditor.subscribe((state,previous)=>{
  if(applying||!session)return;
  const room=useBuildTogether.getState();
  if(room.status==='online'){
   const selection=JSON.stringify(state.selectedIds);
   if(selection!==lastSelection){lastSelection=selection;send({type:'selection',ids:state.selectedIds});}
  }
  if(state.project===previous.project)return;
  if(room.status==='reconnecting'){offlineEdits=true;return;}
  if(room.status!=='online')return;
  if(room.role==='spectator'){
   if(latestProject)replaceAuthoritative(latestProject);
   notifyError('Spectators cannot edit the shared map.');return;
  }
  // Coalesce per-frame transform updates and serialize against server revisions.
  dirty=true;scheduleFlush();
 });
}
function stopTimers(){cancelFlush();if(retryTimer!==null){clearTimeout(retryTimer);retryTimer=null;}
 if(pingTimer!==null){clearInterval(pingTimer);pingTimer=null;}}
function reset(reason=''){
 generation++;stopTimers();unlisten?.();unlisten=null;session=null;connection=null;latestProject=null;
 dirty=false;inFlight=false;changeSentAt=0;offlineEdits=false;lastSelection='';lastCameraSignature='';awaitingPong=false;
 useBuildTogether.setState({...initial,hasRecoveryBackup:savedBackup(),error:reason});
}
export function leaveBuildTogether(){const socket=connection;
 if(socket?.readyState===WebSocket.OPEN)send({type:'leave'});
 reset();socket?.close();
}
export async function createBuildTogether(name:string){
 if(useBuildTogether.getState().status!=='offline')throw Error('Leave your current session first.');
 const response=await fetch('/api/buildtogether/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:useEditor.getState().project})});
 const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);
 await joinBuildTogether('127.0.0.1:49178',data.code,name,{hostKey:data.hostKey});
}
function startPing(){
 if(pingTimer!==null)clearInterval(pingTimer);
 pingTimer=setInterval(()=>{
  if(useBuildTogether.getState().status!=='online')return;
  if((awaitingPong&&Date.now()-pingSentAt>20000)||(inFlight&&Date.now()-changeSentAt>15000)){connection?.close();return;}
  if(!awaitingPong){pingSentAt=Date.now();awaitingPong=true;send({type:'ping',nonce:++pingNonce});}
 },4000);
}
function scheduleReconnect(epoch:number,attempt:number){
 if(epoch!==generation||!session)return;
 if(attempt>8){backupEdits('BuildTogether could not reconnect.');reset('Connection lost. The server could not be reached after multiple attempts.');return;}
 const delay=Math.min(6000,Math.round(850*Math.pow(1.6,attempt-1)));
 useBuildTogether.setState({status:'reconnecting',reconnectAttempt:attempt,pingMs:null});
 retryTimer=setTimeout(()=>{retryTimer=null;if(epoch===generation&&session)connectSocket(epoch,attempt);},delay);
}
function connectSocket(epoch:number,attempt:number,resolve?:()=>void,reject?:(error:Error)=>void){
 if(!session||epoch!==generation)return;
 const credentials=session;let socket:WebSocket;
 try{socket=new WebSocket(credentials.url);}catch(error){if(reject)reject(error as Error);else scheduleReconnect(epoch,attempt+1);return;}
 connection=socket;let established=false;let finished=false;
 const failInitial=(reason:string)=>{
  if(finished)return;finished=true;reject?.(Error(reason));reset(reason);try{socket.close()}catch{}
 };
 const timeout=setTimeout(()=>{
  if(epoch!==generation||finished)return;
  if(!established){if(reject)failInitial('BuildTogether server did not answer.');else socket.close();}
 },10000);
 socket.onopen=()=>{
  if(epoch!==generation)return socket.close();
  socket.send(JSON.stringify({type:'join',code:credentials.code,hostKey:credentials.hostKey,name:credentials.name,spectator:credentials.spectator,resumeKey:credentials.resumeKey}));
 };
 socket.onmessage=event=>{
  if(epoch!==generation||connection!==socket)return;
  let message:any;try{message=JSON.parse(String(event.data))}catch{return;}
  if(message.type==='snapshot'){
   if(!message.project||!Array.isArray(message.project.objects))return socket.close();
   clearTimeout(timeout);established=true;finished=true;
   if(typeof message.resumeKey==='string')credentials.resumeKey=message.resumeKey;
   // Any optimistic/offline edits must never vanish silently on resync.
   const recovered=attempt>0&&(offlineEdits||dirty||inFlight);
   if(recovered)backupEdits('Reconnection replaced unconfirmed local changes with the server map.');
   dirty=false;inFlight=false;changeSentAt=0;offlineEdits=false;cancelFlush();
   replaceAuthoritative(message.project as Project);
   useBuildTogether.setState({status:'online',selfId:message.selfId,role:message.role,revision:message.revision,cursors:{},cameras:{},
    participants:message.participants||[],locks:message.locks||[],error:recovered?'Some unconfirmed local edits were backed up; download your recovery copy from BuildTogether.':'',hasRecoveryBackup:savedBackup(),reconnectAttempt:0,pendingChanges:0,lastSyncAt:Date.now()});
   beginSubscription();send({type:'selection',ids:useEditor.getState().selectedIds});startPing();resolve?.();return;
  }
  if(message.type==='presence'){
   const participants:Member[]=message.participants||[];
   useBuildTogether.setState(state=>({participants,locks:message.locks||[],followId:state.followId&&participants.some(member=>member.id===state.followId)?state.followId:null,
    cursors:Object.fromEntries(Object.entries(state.cursors).filter(([id])=>participants.some(member=>member.id===id)))}));return;
  }
  if(message.type==='camera'){
   if(message.id!==useBuildTogether.getState().selfId)useBuildTogether.setState(state=>({cameras:{...state.cameras,[message.id]:message.pose as CameraPose}}));return;
  }
  if(message.type==='cursor'){
   if(message.id!==useBuildTogether.getState().selfId)useBuildTogether.setState(state=>({cursors:{...state.cursors,[message.id]:{id:message.id,x:message.x,y:message.y}}}));return;
  }
  if(message.type==='pong'){
   if(awaitingPong&&message.nonce===pingNonce){awaitingPong=false;const rtt=Date.now()-pingSentAt;
    useBuildTogether.setState(state=>({pingMs:state.pingMs===null?rtt:Math.round(state.pingMs*.7+rtt*.3),
     jitterMs:state.pingMs===null?0:Math.round((state.jitterMs??0)*.7+Math.abs(rtt-state.pingMs)*.3)}));}return;
  }
  if(message.type==='change'){
   useBuildTogether.setState({revision:message.revision,lastSyncAt:Date.now()});
   if(message.author!==useBuildTogether.getState().selfId)acceptIncoming(message.ops,message.meta||undefined);
   else{
    if(latestProject)latestProject=mapOp(latestProject,message.ops,message.meta||undefined);
    inFlight=false;changeSentAt=0;
    const outstanding=latestProject?changes(latestProject,useEditor.getState().project):{ops:[] as ChangeOp[],meta:undefined};
    useBuildTogether.setState({pendingChanges:outstanding.ops.length+(outstanding.meta?1:0)});
   }
   // Process the next bounded batch after acknowledgement, never against a stale base.
   if(dirty||message.author===useBuildTogether.getState().selfId)scheduleFlush(0);
   return;
  }
  if(message.type==='rejected'){
   if(inFlight||dirty)backupEdits(message.reason||'Change rejected by host.');
   inFlight=false;changeSentAt=0;dirty=false;cancelFlush();
   if(message.project)replaceAuthoritative(message.project);
   useBuildTogether.setState({revision:message.revision??0,pendingChanges:0});
   notifyError(message.reason||'Change rejected by host');return;
  }
  if(message.type==='closed'){
   clearTimeout(timeout);if(!established&&reject)reject(Error(message.reason||'Session ended'));
   socket.close();reset(message.reason||'Session ended');return;
  }
 };
 socket.onerror=()=>{if(socket.readyState!==WebSocket.CLOSED)try{socket.close()}catch{}};
 socket.onclose=()=>{
  clearTimeout(timeout);if(epoch!==generation||connection!==socket)return;
  connection=null;stopTimers();awaitingPong=false;
  if(!established&&reject){failInitial('Cannot connect. Check the BuildTogether address, session code and TCP port 49178.');return;}
  if(!established&&attempt===0){reset('Connection closed before joining.');return;}
  scheduleReconnect(epoch,attempt+1);
 };
}
export function joinBuildTogether(address:string,code:string,name:string,options:{hostKey?:string;spectator?:boolean}={}):Promise<void>{
 if(useBuildTogether.getState().status!=='offline')return Promise.reject(Error('Already in a session.'));
 let url:string;try{url=normalizedEndpoint(address);}catch(error){return Promise.reject(error);}
 reset();const epoch=generation;
 session={url,address,code:code.trim(),name:name.trim()||'Mapper',hostKey:options.hostKey||'',resumeKey:'',spectator:options.spectator===true};
 useBuildTogether.setState({...initial,status:'connecting',server:address,code:session.code,remoteName:session.name,host:Boolean(session.hostKey)});
 return new Promise((resolve,reject)=>connectSocket(epoch,0,resolve,reject));
}
export function sendBuildTogetherCursor(x:number,y:number){
 const now=Date.now();if(now-lastCursorAt<75)return;lastCursorAt=now;
 if(useBuildTogether.getState().status==='online'&&Number.isFinite(x)&&Number.isFinite(y))send({type:'cursor',x,y},true);
}
export function lockOwner(id:string){const s=useBuildTogether.getState();return s.locks.find(l=>l.id===id)?.owner||null;}
export function sendBuildTogetherCamera(pose:CameraPose){
 const now=Date.now();if(now-lastCameraAt<160)return;
 const signature=JSON.stringify(pose);if(signature===lastCameraSignature)return;
 lastCameraSignature=signature;lastCameraAt=now;
 const state=useBuildTogether.getState();if(state.status==='online'&&!state.followId)send({type:'camera',pose},true);
}
export function setBuildTogetherFollow(id:string|null){useBuildTogether.setState({followId:id});}

/** Explicit user action: export locally backed-up changes as an editable project.
 * Never silently merge an offline copy over the server's authoritative map.
 */
export function downloadBuildTogetherBackup(){
 try{
  const saved=sessionStorage.getItem(backupKey);if(!saved)return false;
  const project=JSON.parse(saved);if(!project||!Array.isArray(project.objects))return false;
  const url=URL.createObjectURL(new Blob([saved],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='SvenStudio_BuildTogether_Recovery.svenstudio.json';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
 }catch{return false;}
}
