/** BuildTogether 3.5. Only Project objects and world metadata are shared.
 * SDK paths, imported WAD binaries, compiler settings and local files stay private.
 * Changes are serialized against server acknowledgements. Independent studio
 * metadata is synchronized field-by-field; presence packets remain lossy.
 */
import {create} from 'zustand';
import {useEditor} from '../store';
import type {MapObject,Project} from './types';
export type Member={id:string;name:string;color:string;role:'host'|'editor'|'spectator';selection:string[];activity?:string;pingMs?:number|null};
export type Lock={id:string;owner:string};
export type RemoteCursor={id:string;x:number;y:number};
export type CameraPose={projection:'perspective'|'orthographic';position:[number,number,number];target:[number,number,number];up:[number,number,number];orthoHeight:number;fov?:number;aspect?:number};
type Status='offline'|'connecting'|'reconnecting'|'online';
type CollaborationState={hasRecoveryBackup:boolean;status:Status;server:string;code:string;role:string;selfId:string;participants:Member[];locks:Lock[];cursors:Record<string,RemoteCursor>;cameras:Record<string,CameraPose>;followId:string|null;showRemoteCameras:boolean;showViewCones:boolean;activity:string;revision:number;error:string;host:boolean;remoteName:string;pingMs:number|null;jitterMs:number|null;reconnectAttempt:number;pendingChanges:number;lastSyncAt:number;conflictCount:number;lastConflict:string};
const savedBackup=()=>{try{return Boolean(sessionStorage.getItem('svenstudio:buildtogether-disconnected-backup'));}catch{return false;}};
const initial:CollaborationState={hasRecoveryBackup:savedBackup(),status:'offline',server:'127.0.0.1:49178',code:'',role:'',selfId:'',participants:[],locks:[],cursors:{},cameras:{},followId:null,showRemoteCameras:true,showViewCones:true,activity:'exploring',revision:0,error:'',host:false,remoteName:'',pingMs:null,jitterMs:null,reconnectAttempt:0,pendingChanges:0,lastSyncAt:0,conflictCount:0,lastConflict:''};
export const useBuildTogether=create<CollaborationState>(()=>initial);
type ChangeOp={kind:'put'|'delete';id:string;object?:MapObject};
type MetaPatch={set:Record<string,unknown>;unset:string[]};
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
let activeDialog:string|null=null,lastStatusSent=0,lastStatusSignature='';
let statusTimer:ReturnType<typeof setTimeout>|null=null;
let pingNonce=0,pingSentAt=0,awaitingPong=false;
// Transport fragmentation for Porthole / private TCP bridges. No individual
// WebSocket payload exceeds ~22 KiB; completed map transactions stay atomic.
const FRAGMENT_BYTES=16*1024;
const FRAGMENT_THRESHOLD=32*1024;
let queuedFrames:string[]=[];
let fragmentTimer:ReturnType<typeof setTimeout>|null=null;
let fragmentSerial=0;
function pumpFragments(){
 fragmentTimer=null;
 const socket=connection;
 if(!socket||socket.readyState!==WebSocket.OPEN){queuedFrames=[];return;}
 if(socket.bufferedAmount<96*1024&&queuedFrames.length)socket.send(queuedFrames.shift()!);
 if(queuedFrames.length)fragmentTimer=setTimeout(pumpFragments,25);
}
function stopFragments(){if(fragmentTimer!==null)clearTimeout(fragmentTimer);fragmentTimer=null;queuedFrames=[];}

// Preserve a peer's marker through short disconnect/rejoin gaps. Never retain locks.
const missingPeers=new Map<string,number>();
let peerPruneTimer:ReturnType<typeof setTimeout>|null=null;
function pruneMissingPeers(){
 if(peerPruneTimer!==null)clearTimeout(peerPruneTimer);
 peerPruneTimer=null;
 const now=Date.now();
 const expired=[...missingPeers].filter(([,until])=>until<=now).map(([id])=>id);
 for(const id of expired)missingPeers.delete(id);
 if(expired.length)useBuildTogether.setState(state=>({
  participants:state.participants.filter(member=>!expired.includes(member.id)),
  cameras:Object.fromEntries(Object.entries(state.cameras).filter(([id])=>!expired.includes(id)))}));
 if(missingPeers.size)peerPruneTimer=setTimeout(pruneMissingPeers,Math.max(100,Math.min(...missingPeers.values())-Date.now()));
}

const copy=<T,>(value:T):T=>structuredClone(value);
const backupKey='svenstudio:buildtogether-disconnected-backup';
/** Small, fixed activity codes; never send project paths, filenames or UI text. */
export function describeBuildTogetherActivity(state:ReturnType<typeof useEditor.getState>,dialog:string|null=null):string{
 if(dialog){const codes:Record<string,string>={terrain:'terrain',cinematic:'cinematic',npc:'npc',sound:'sound',lighting:'lighting',gameplay:'gameplay',doctor:'doctor',packager:'packager',visibility:'visibility',buildTogether:'buildtogether',settings:'settings',layout:'settings',entityAppearance:'settings',output:'editing'};return codes[dialog]||'editing';}
 if(state.terrainPlacement)return 'terrain';
 if(state.architecturePlacement)return 'architecture';
 if(state.pendingNpcClass||state.routePlacementFor)return 'npc';
 if(state.audioPlacement)return 'sound';
 if(state.environmentPlacement)return 'lighting';
 if(state.cinematicPlacementFor)return 'cinematic';
 if(state.activeDecal)return 'decals';
 if(state.placementShape||state.placementPrefabId)return 'smartbuild';
 if(state.textureStudioOpen||state.textureDragSnapshot)return 'texturing';
 if(state.walkMode)return 'walk';
 if(state.drawMode)return 'drawing';
 if(state.mode==='translate')return 'moving';
 if(state.mode==='rotate')return 'rotating';
 if(state.mode==='scale')return 'scaling';
 if(state.selectedIds?.length)return 'selecting';
 if(state.resourceView==='models')return 'models';
 if(state.resourceView==='materials')return 'materials';
 return 'exploring';
}
function publishActivity(force=false){
 const room=useBuildTogether.getState();if(room.status!=='online')return;
 const activity=describeBuildTogetherActivity(useEditor.getState(),activeDialog);
 if(room.activity!==activity)useBuildTogether.setState({activity});
 const signature=`${activity}:${room.pingMs??'-'}`;
 if(!force&&signature===lastStatusSignature)return;
 const delay=Math.max(0,lastStatusSent+800-Date.now());
 if(delay){if(statusTimer===null)statusTimer=setTimeout(()=>{statusTimer=null;publishActivity(force)},delay);return;}
 if(send({type:'member-status',activity,pingMs:room.pingMs},true)){lastStatusSent=Date.now();lastStatusSignature=signature;}
}
export function setBuildTogetherDialog(dialog:string|null){activeDialog=dialog;publishActivity();}
export function setBuildTogetherCameraVisibility(show:boolean){useBuildTogether.setState({showRemoteCameras:show});}
export function setBuildTogetherViewCones(show:boolean){useBuildTogether.setState({showViewCones:show});}

// An explicit allowlist prevents imported project extensions from sending
// local paths or unrelated application state over a multiplayer connection.
const sharedProjectKeys=new Set(['version','name','world','wadNames','target','graphPositions','cinematicPreviewSpeeds','terrainGroups','pathGroups','architectureLayouts','architectureAssemblies','architectureOpenings','customNpcs','surfaceSounds']);
function normalizedEndpoint(input:string){
 const raw=input.trim().replace(/^https?:\/\//i,'').replace(/^wss?:\/\//i,'').replace(/\/.*$/,'');
 if(!/^(?:\[[a-f\d:]+\]|[a-z\d.-]+)(?::\d{1,5})?$/i.test(raw))throw Error('Enter a server address, such as 192.168.1.10:49178.');
 const host=raw.includes(':')?raw:raw+':49178';
 return `${location.protocol==='https:'?'wss':'ws'}://${host}/buildtogether`;
}
function metadata(project:Project){return Object.fromEntries(Object.entries(project).filter(([key])=>sharedProjectKeys.has(key))) as Omit<Project,'objects'>;}
function patchMetadata(project:Project,patch?:MetaPatch):Project{
 if(!patch)return project;
 const updated:Record<string,unknown>={...project,...patch.set};
 for(const key of patch.unset)delete updated[key];
 return updated as unknown as Project;
}
function metadataChanges(before:Project,after:Project):MetaPatch|undefined{
 const old=metadata(before) as Record<string,unknown>,now=metadata(after) as Record<string,unknown>;
 const set:Record<string,unknown>={},unset:string[]=[];
 for(const key of new Set([...Object.keys(old),...Object.keys(now)])){
  if(JSON.stringify(old[key])===JSON.stringify(now[key]))continue;
  if(Object.prototype.hasOwnProperty.call(now,key))set[key]=now[key];else unset.push(key);
 }
 return Object.keys(set).length||unset.length?{set,unset}:undefined;
}
function mapOp(project:Project,ops:ChangeOp[],meta?:Partial<Project>,metaPatch?:MetaPatch){
 const items=new Map(project.objects.map(o=>[o.id,o]));
 for(const op of ops){if(op.kind==='delete')items.delete(op.id);else if(op.object)items.set(op.id,copy(op.object));}
 return {...patchMetadata({...project,...meta},metaPatch),objects:[...items.values()]};
}
function changes(before:Project,after:Project):{ops:ChangeOp[];metaPatch?:MetaPatch}{
 const oldMap=new Map(before.objects.map(o=>[o.id,o]));const nextMap=new Map(after.objects.map(o=>[o.id,o]));
 const ops:ChangeOp[]=[];
 for(const [id,object] of nextMap){const previous=oldMap.get(id);if(!previous||previous!==object&&JSON.stringify(previous)!==JSON.stringify(object))ops.push({kind:'put',id,object});}
 for(const id of oldMap.keys())if(!nextMap.has(id))ops.push({kind:'delete',id});
 return {ops,metaPatch:metadataChanges(before,after)};
}
/** Reconcile after a lost acknowledgement or a server correction. An accepted
 * partial terrain batch is already present in `server`; only the remaining
 * local brushes are replayed. Conflicting remote edits remain authoritative. */
function reconcilePending(base:Project,local:Project,server:Project){
 const pending=changes(base,local),remote=changes(base,server);
 const remoteIds=new Set(remote.ops.map(op=>op.id));
 const serverObjects=new Map(server.objects.map(object=>[object.id,object]));
 const localObjects=new Map(local.objects.map(object=>[object.id,object]));
 const safeOps:ChangeOp[]=[],conflicts:string[]=[];
 for(const op of pending.ops){
  if(remoteIds.has(op.id)){
   // The server may have received this brush before the connection dropped.
   if(JSON.stringify(serverObjects.get(op.id))!==JSON.stringify(localObjects.get(op.id)))conflicts.push(op.id);
   continue;
  }
  safeOps.push(op);
 }
 const changedRemoteKeys=new Set([...Object.keys(remote.metaPatch?.set||{}),...(remote.metaPatch?.unset||[])]);
 const safeMeta:MetaPatch={set:{},unset:[]};
 for(const [key,value] of Object.entries(pending.metaPatch?.set||{})){
  if(changedRemoteKeys.has(key)){
   if(JSON.stringify((server as unknown as Record<string,unknown>)[key])!==JSON.stringify(value))conflicts.push(`metadata:${key}`);
  }else safeMeta.set[key]=value;
 }
 for(const key of pending.metaPatch?.unset||[]){
  if(changedRemoteKeys.has(key)){
   if(Object.prototype.hasOwnProperty.call(server,key))conflicts.push(`metadata:${key}`);
  }else safeMeta.unset.push(key);
 }
 const metaPatch=Object.keys(safeMeta.set).length||safeMeta.unset.length?safeMeta:undefined;
 return {project:mapOp(server,safeOps,undefined,metaPatch),conflicts,
  hasPending:safeOps.length>0||!!metaPatch};
}
function notifyError(reason:string){useBuildTogether.setState({error:reason});useEditor.getState().appendLogs(['BuildTogether: '+reason]);}
function send(value:object,ephemeral=false){
 const socket=connection;if(!socket||socket.readyState!==WebSocket.OPEN)return false;
 if(ephemeral&&(queuedFrames.length>0||socket.bufferedAmount>128*1024))return false;
 const serialized=JSON.stringify(value);
 const encoded=new TextEncoder().encode(serialized);
 if(encoded.byteLength>=8*1024*1024){
  if(!ephemeral)backupEdits('The change packet exceeds the safe BuildTogether limit (8 MiB).');
  return false;
 }
 if(!ephemeral&&encoded.length>FRAGMENT_THRESHOLD){
  const total=Math.ceil(encoded.length/FRAGMENT_BYTES);
  const id=`c${++fragmentSerial}`;
  for(let index=0;index<total;index++){
   const bytes=encoded.subarray(index*FRAGMENT_BYTES,(index+1)*FRAGMENT_BYTES);
   // 16 KiB is deliberately below the browser's argument-count threshold.
   const data=btoa(String.fromCharCode(...bytes));
   queuedFrames.push(JSON.stringify({type:'fragment',id,index,total,data}));
  }
  if(fragmentTimer===null)fragmentTimer=setTimeout(pumpFragments,0);
  return true;
 }
 socket.send(serialized);return true;
}
/** Remote changes are immutable. Reuse their object references across undo
 * checkpoints instead of deep-cloning every terrain brush 70 times. Keeping
 * the history rebased prevents Undo from reverting a teammate's geometry.
 * 512 brushes x 70 checkpoints previously caused long main-thread stalls.
 */
function rebaseHistory(projects:Project[],ops:ChangeOp[],meta?:Partial<Project>,metaPatch?:MetaPatch){
 if(!projects.length)return projects;
 return projects.map(project=>{
  const items=new Map(project.objects.map(o=>[o.id,o]));
  for(const op of ops){if(op.kind==='delete')items.delete(op.id);else if(op.object)items.set(op.id,op.object);}
  return {...patchMetadata({...project,...meta},metaPatch),objects:[...items.values()]};
 });
}
function replaceAuthoritative(project:Project){
 applying=true;
 try{
  latestProject=copy(project);
  const ids=new Set(project.objects.map(o=>o.id));
  useEditor.setState(state=>({project:copy(project),selected:state.selected&&ids.has(state.selected)?state.selected:null,
   selectedIds:state.selectedIds.filter(id=>ids.has(id)),history:[],future:[]}));
 }finally{applying=false;}
}
function acceptIncoming(ops:ChangeOp[],meta?:Partial<Project>,metaPatch?:MetaPatch){
 applying=true;
 try{
  const base=latestProject;
  // Preserve local unacknowledged changes when a teammate edits concurrently.
  // Before this fix a remote world/terrain metadata update could overwrite an
  // in-flight terrain group on the local client, making generated tools vanish.
  const local=useEditor.getState().project;
  const pending=base?changes(base,local):{ops:[] as ChangeOp[],metaPatch:undefined};
  const remoteIds=new Set(ops.map(op=>op.id));
  const localOps=pending.ops.filter(op=>!remoteIds.has(op.id));
  const changedMetaKeys=new Set(metaPatch?[...Object.keys(metaPatch.set),...metaPatch.unset]:meta?Object.keys(meta):[]);
  const localMeta:MetaPatch={set:{},unset:[]};
  const locallyPending=pending.metaPatch;
  for(const [key,value] of Object.entries(locallyPending?.set||{}))if(!changedMetaKeys.has(key))localMeta.set[key]=value;
  for(const key of locallyPending?.unset||[])if(!changedMetaKeys.has(key))localMeta.unset.push(key);
  // Never silently drop unacknowledged edits to the same object or studio.
  const conflictingIds=pending.ops.filter(op=>remoteIds.has(op.id)).map(op=>op.id);
  const conflictingMeta=[...changedMetaKeys].filter(key=>Object.prototype.hasOwnProperty.call(locallyPending?.set||{},key)||locallyPending?.unset.includes(key));
  if(conflictingIds.length||conflictingMeta.length){
   const reason=`Concurrent edits conflict (${conflictingIds.length} objects, ${conflictingMeta.join(', ')||'no studio metadata'}).`;
   backupEdits(reason);useBuildTogether.setState(state=>({conflictCount:state.conflictCount+1,lastConflict:reason}));
  }
  if(base)latestProject=mapOp(base,ops,meta,metaPatch);
  useEditor.setState(state=>{
   const project=mapOp(latestProject||state.project,localOps,undefined,localMeta);
   const ids=new Set(project.objects.map(object=>object.id));
   return {project,selected:state.selected&&ids.has(state.selected)?state.selected:null,
    selectedIds:state.selectedIds.filter(id=>ids.has(id)),
    history:rebaseHistory(state.history,ops,meta,metaPatch),future:rebaseHistory(state.future,ops,meta,metaPatch)};
  });
  if(localOps.length||Object.keys(localMeta.set).length||localMeta.unset.length){dirty=true;scheduleFlush(0);}
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
 if(!delta.ops.length&&!delta.metaPatch){dirty=false;useBuildTogether.setState({pendingChanges:0});return;}
 if(useEditor.getState().project.objects.length>25000){backupEdits('BuildTogether supports at most 25,000 map objects.');replaceAuthoritative(latestProject);return;}
 const foreignLocks=new Set(room.locks.filter(lock=>lock.owner!==room.selfId).map(lock=>lock.id));
 if(delta.ops.some(op=>foreignLocks.has(op.id))){backupEdits('Another mapper owns an edited object.');replaceAuthoritative(latestProject);return;}
 // Large operations such as Terrain/Architecture must transfer all brushes
 // before publishing provenance metadata. This prevents remote clients from
 // seeing a terrain group whose brushIds have not reached the server yet.
 // Prefer one atomic update per complete Terrain Studio operation (at most
 // 512 brushes). This avoids re-rendering incomplete terrain four times and
 // repeatedly rebasing deep undo histories on receiving browsers. Maintain a
 // 1.5 MB wire budget for all bulk changes; split only if necessary.
 let count=Math.min(512,delta.ops.length);
 let ops=delta.ops.slice(0,count);
 let finalBatch=delta.ops.length<=count;
 let metaPatch=finalBatch?delta.metaPatch:undefined;
 let packet={type:'change',base:room.revision,ops,...(metaPatch?{metaPatch}:{})};
 const encoder=new TextEncoder();
 while(count>1&&encoder.encode(JSON.stringify(packet)).byteLength>1_500_000){
  count=Math.max(1,Math.floor(count/2));ops=delta.ops.slice(0,count);
  finalBatch=delta.ops.length<=count;metaPatch=finalBatch?delta.metaPatch:undefined;
  packet={type:'change',base:room.revision,ops,...(metaPatch?{metaPatch}:{})};
 }
 if(send(packet)){
  inFlight=true;changeSentAt=Date.now();dirty=false;useBuildTogether.setState({pendingChanges:delta.ops.length+(delta.metaPatch?1:0)});
 }
}
function beginSubscription(){
 unlisten?.();lastSelection=JSON.stringify(useEditor.getState().selectedIds);
 unlisten=useEditor.subscribe((state,previous)=>{
  if(applying||!session)return;
  const room=useBuildTogether.getState();
  if(room.status==='online'){
   if(state.mode!==previous.mode||state.terrainPlacement!==previous.terrainPlacement||state.architecturePlacement!==previous.architecturePlacement||state.pendingNpcClass!==previous.pendingNpcClass||state.routePlacementFor!==previous.routePlacementFor||state.audioPlacement!==previous.audioPlacement||state.environmentPlacement!==previous.environmentPlacement||state.cinematicPlacementFor!==previous.cinematicPlacementFor||state.activeDecal!==previous.activeDecal||state.textureStudioOpen!==previous.textureStudioOpen||state.placementShape!==previous.placementShape||state.selectedIds!==previous.selectedIds||state.resourceView!==previous.resourceView||state.walkMode!==previous.walkMode||state.drawMode!==previous.drawMode)publishActivity();
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
function stopTimers(){stopFragments();cancelFlush();if(statusTimer!==null){clearTimeout(statusTimer);statusTimer=null;}if(retryTimer!==null){clearTimeout(retryTimer);retryTimer=null;}
 if(pingTimer!==null){clearInterval(pingTimer);pingTimer=null;}}
function reset(reason=''){
 generation++;stopTimers();unlisten?.();unlisten=null;session=null;connection=null;latestProject=null;
 dirty=false;inFlight=false;changeSentAt=0;offlineEdits=false;lastSelection='';lastCameraSignature='';lastStatusSignature='';lastStatusSent=0;awaitingPong=false;missingPeers.clear();
 useBuildTogether.setState({...initial,hasRecoveryBackup:savedBackup(),error:reason});
}
export function leaveBuildTogether(){const socket=connection;
 if(socket?.readyState===WebSocket.OPEN)send({type:'leave'});
 reset();socket?.close();
}
export async function createBuildTogether(name:string){
 if(useBuildTogether.getState().status!=='offline')throw Error('Leave your current session first.');
 const local=useEditor.getState().project;
 const shared:Project={...metadata(local),objects:local.objects};
 const response=await fetch('/api/buildtogether/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:shared})});
 const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);
 await joinBuildTogether('127.0.0.1:49178',data.code,name,{hostKey:data.hostKey});
}
function startPing(){
 if(pingTimer!==null)clearInterval(pingTimer);
 pingTimer=setInterval(()=>{
  if(useBuildTogether.getState().status!=='online')return;
  // A busy browser can spend several seconds constructing hundreds of
  // meshes. Do not force a reconnect during a recoverable bulk scene update;
  // TCP and the server's heartbeat are responsible for detecting dead peers.
  if((awaitingPong&&Date.now()-pingSentAt>60000)||(inFlight&&Date.now()-changeSentAt>120000)){
   useEditor.getState().appendLogs(['BuildTogether: synchronization stalled; reconnecting to recover the authoritative map.']);
   connection?.close();return;
  }
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
 let inbound:{id:string;next:number;total:number;chunks:Uint8Array[];bytes:number;deadline:number}|null=null;

 const failInitial=(reason:string)=>{
  if(finished)return;finished=true;reject?.(Error(reason));reset(reason);try{socket.close()}catch{}
 };
 const timeout=setTimeout(()=>{
  if(epoch!==generation||finished)return;
  if(!established){if(reject)failInitial('BuildTogether server did not answer.');else socket.close();}
 },30000);
 socket.onopen=()=>{
  if(epoch!==generation)return socket.close();
   socket.send(JSON.stringify({type:'join',protocol:4,code:credentials.code,hostKey:credentials.hostKey,name:credentials.name,spectator:credentials.spectator,resumeKey:credentials.resumeKey}));
 };
 socket.onmessage=event=>{
  if(epoch!==generation||connection!==socket)return;
  let message:any;try{message=JSON.parse(String(event.data))}catch{return;}
  if(message.type==='fragment'){
   const item=message;
   if(typeof item.id!=='string'||!/^s[0-9]+$/.test(item.id)||!Number.isInteger(item.index)||
    !Number.isInteger(item.total)||item.total<2||item.total>768||typeof item.data!=='string'||
    item.data.length>24000||!/^[A-Za-z0-9+/]+={0,2}$/.test(item.data)){socket.close();return;}
   if(!inbound){
    if(item.index!==0){socket.close();return;}
    inbound={id:item.id,next:0,total:item.total,chunks:[],bytes:0,deadline:Date.now()+60000};
   }
   if(Date.now()>inbound.deadline||item.id!==inbound.id||item.total!==inbound.total||item.index!==inbound.next){socket.close();return;}
   let part:Uint8Array;try{const decoded=atob(item.data);part=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)part[i]=decoded.charCodeAt(i);}catch{socket.close();return;}
   if(part.length<1||part.length>FRAGMENT_BYTES||inbound.bytes+part.length>=8*1024*1024){socket.close();return;}
   inbound.chunks.push(part);inbound.bytes+=part.length;inbound.next++;
   if(inbound.next<inbound.total)return;
   const all=new Uint8Array(inbound.bytes);let offset=0;
   for(const chunk of inbound.chunks){all.set(chunk,offset);offset+=chunk.length;}
   inbound=null;
   try{message=JSON.parse(new TextDecoder().decode(all));}catch{socket.close();return;}
  }
  if(message.type==='snapshot'){
   if(!message.project||!Array.isArray(message.project.objects))return socket.close();
   clearTimeout(timeout);established=true;finished=true;
   if(typeof message.resumeKey==='string')credentials.resumeKey=message.resumeKey;
   const serverProject=message.project as Project;
   const baseline=latestProject,local=useEditor.getState().project;
   const hadPending=attempt>0&&(offlineEdits||dirty||inFlight||Boolean(baseline&&changes(baseline,local).ops.length));
   const recovery=hadPending&&baseline?reconcilePending(baseline,local,serverProject):null;
   // A different edit to the same brush must never be overwritten.
   if(recovery?.conflicts.length)backupEdits(`Reconnection conflicts: ${recovery.conflicts.slice(0,8).join(', ')}.`);
   else if(hadPending&&!baseline)backupEdits('Unconfirmed edits could not be reconciled after reconnecting.');
   dirty=false;inFlight=false;changeSentAt=0;offlineEdits=false;cancelFlush();
   replaceAuthoritative(serverProject);
   if(recovery?.hasPending){applying=true;try{useEditor.setState({project:recovery.project});}finally{applying=false;}dirty=true;}
   const oldCameras=useBuildTogether.getState().cameras;
   useBuildTogether.setState({status:'online',selfId:message.selfId,role:message.role,revision:message.revision,cursors:{},
    participants:message.participants||[],locks:message.locks||[],cameras:{...oldCameras,...(message.cameras||{})},
    error:recovery?.conflicts.length?'Some conflicting edits were saved as a recovery copy.':'',hasRecoveryBackup:savedBackup(),reconnectAttempt:0,
    pendingChanges:0,lastSyncAt:Date.now()});
   beginSubscription();if(dirty)scheduleFlush(0);
   send({type:'selection',ids:useEditor.getState().selectedIds});startPing();publishActivity(true);resolve?.();return;
  }
  if(message.type==='presence'){
   const participants:Member[]=message.participants||[];
   const liveIds=new Set(participants.map(member=>member.id));
   for(const id of liveIds)missingPeers.delete(id);
   useBuildTogether.setState(state=>{
    for(const member of state.participants)if(!liveIds.has(member.id)&&state.cameras[member.id]&&!missingPeers.has(member.id))missingPeers.set(member.id,Date.now()+3500);
    const stale=state.participants.filter(member=>!liveIds.has(member.id)&&(missingPeers.get(member.id)||0)>Date.now())
     .map(member=>({...member,selection:[],activity:'reconnecting',pingMs:null}));
    const visible=[...participants,...stale];
    return {participants:visible,locks:message.locks||[],followId:state.followId&&visible.some(member=>member.id===state.followId)?state.followId:null,
     cursors:Object.fromEntries(Object.entries(state.cursors).filter(([id])=>liveIds.has(id)))};
   });
   pruneMissingPeers();return;
  }
  if(message.type==='member-status'){
   if(message.id!==useBuildTogether.getState().selfId)useBuildTogether.setState(state=>({participants:state.participants.map(member=>member.id===message.id?{...member,activity:message.activity,pingMs:message.pingMs}:member)}));
   return;
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
     jitterMs:state.pingMs===null?0:Math.round((state.jitterMs??0)*.7+Math.abs(rtt-state.pingMs)*.3)}));publishActivity();}return;
  }
  if(message.type==='change'){
   useBuildTogether.setState({revision:message.revision,lastSyncAt:Date.now()});
   if(message.author!==useBuildTogether.getState().selfId)acceptIncoming(message.ops,message.meta||undefined,message.metaPatch||undefined);
   else{
    if(latestProject)latestProject=mapOp(latestProject,message.ops,message.meta||undefined,message.metaPatch||undefined);
    inFlight=false;changeSentAt=0;
    const outstanding=latestProject?changes(latestProject,useEditor.getState().project):{ops:[] as ChangeOp[],metaPatch:undefined};
    useBuildTogether.setState({pendingChanges:outstanding.ops.length+(outstanding.metaPatch?1:0)});
   }
   // Process the next bounded batch after acknowledgement, never against a stale base.
   if(dirty||message.author===useBuildTogether.getState().selfId)scheduleFlush(0);
   return;
  }
  if(message.type==='rejected'){
   const reason=message.reason||'Change rejected by host';
   const baseline=latestProject,local=useEditor.getState().project;
   const canRetry=Boolean(message.project&&baseline&&/Object changed by another participant|Studio metadata conflict/.test(reason));
   const recovery=canRetry?reconcilePending(baseline!,local,message.project as Project):null;
   if(inFlight||dirty||recovery?.conflicts.length)backupEdits(reason);
   inFlight=false;changeSentAt=0;dirty=false;cancelFlush();
   if(message.project)replaceAuthoritative(message.project);
   if(recovery?.hasPending){applying=true;try{useEditor.setState({project:recovery.project});}finally{applying=false;}dirty=true;}
   useBuildTogether.setState({revision:message.revision??0,pendingChanges:0});
   useBuildTogether.setState(state=>({conflictCount:state.conflictCount+1,lastConflict:reason}));
   notifyError(reason);if(dirty)scheduleFlush(0);return;
  }
  if(message.type==='closed'){
   clearTimeout(timeout);if(!established&&reject)reject(Error(message.reason||'Session ended'));
   socket.close();reset(message.reason||'Session ended');return;
  }
 };
 socket.onerror=()=>{if(socket.readyState!==WebSocket.CLOSED)try{socket.close()}catch{}};
 socket.onclose=event=>{
  clearTimeout(timeout);if(epoch!==generation||connection!==socket)return;
  // Keep a concise diagnosis in the existing output panel. WebSocket 1006
  // usually indicates a transport interruption, not a deliberate map reset.
  const outstanding=useBuildTogether.getState().pendingChanges;
  useEditor.getState().appendLogs([`BuildTogether: WebSocket closed (code ${event.code}, pending ${outstanding}). Attempting to reconnect.`]);
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
 const state=useBuildTogether.getState();if(state.status!=='online'||state.followId)return;
 if(typeof document!=='undefined'&&document.hidden)return;
 const now=Date.now();
 // Motion stays responsive on a healthy LAN; backpressure lowers send rate
 // without touching the editor's render loop or delaying authoritative edits.
 const congestion=connection?.bufferedAmount||0;
 const minInterval=congestion>64*1024?280:state.jitterMs!==null&&state.jitterMs>90?190:115;
 if(now-lastCameraAt<minInterval)return;
 const signature=JSON.stringify(pose);if(signature===lastCameraSignature)return;
 // A lossy sample isn't acknowledged; do not mark it delivered when dropped.
 if(send({type:'camera',pose},true)){lastCameraSignature=signature;lastCameraAt=now;}
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
