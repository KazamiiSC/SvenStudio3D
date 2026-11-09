import {useEffect,useRef,useState} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {Users,Copy,Wifi,WifiOff,X,Lock,MousePointer2,Globe,ShieldCheck,UserPlus,Activity,RefreshCw,BookOpen,ChevronRight,Server,CheckCircle2,AlertTriangle,Camera,Eye,EyeOff,ChevronUp,ChevronDown} from 'lucide-react';
import {useBuildTogether,createBuildTogether,joinBuildTogether,leaveBuildTogether,sendBuildTogetherCursor,setBuildTogetherFollow,downloadBuildTogetherBackup,setBuildTogetherCameraVisibility,setBuildTogetherViewCones} from '../engine/buildTogetherClient';
import {useEditor} from '../store';

const activityNames:Record<string,[string,string]>={
 exploring:['Explorando el mapa','Exploring map'],selecting:['Seleccionando objetos','Selecting objects'],moving:['Moviendo brushes','Moving brushes'],
 rotating:['Rotando brushes','Rotating brushes'],scaling:['Escalando brushes','Scaling brushes'],drawing:['Dibujando geometría','Drawing geometry'],
 texturing:['Texture Studio','Texture Studio'],terrain:['Terrain & Shape Studio','Terrain & Shape Studio'],architecture:['Architecture Mode','Architecture Mode'],
 npc:['NPC & AI Studio','NPC & AI Studio'],sound:['Sound Studio','Sound Studio'],lighting:['Lighting Studio','Lighting Studio'],
 gameplay:['Gameplay Studio','Gameplay Studio'],cinematic:['Cinematic Camera Studio','Cinematic Camera Studio'],
 decals:['Decal Studio','Decal Studio'],models:['Model Browser','Model Browser'],materials:['Material Studio','Material Studio'],
 doctor:['Map Doctor','Map Doctor'],packager:['Map Packager','Map Packager'],buildtogether:['BuildTogether','BuildTogether'],
 settings:['Configuración','Settings'],bsp:['BSP Viewer','BSP Viewer'],visibility:['Visibilidad','Visibility'],
 editing:['Editando el mapa','Editing map'],walk:['Probando el mapa','Testing map'],smartbuild:['Construcción inteligente','Smart building']
};
function activityText(code:string|undefined,es:boolean){return (activityNames[code||'exploring']||activityNames.exploring)[es?0:1]}

/** In-viewport BuildTogether presence, separate from the movable HUD editor. */
export function BuildTogetherPresenceDock(){
 const status=useBuildTogether(s=>s.status),members=useBuildTogether(s=>s.participants);
 const selfId=useBuildTogether(s=>s.selfId),ping=useBuildTogether(s=>s.pingMs);
 const followId=useBuildTogether(s=>s.followId),localActivity=useBuildTogether(s=>s.activity);
 const show=useBuildTogether(s=>s.showRemoteCameras),cones=useBuildTogether(s=>s.showViewCones);
 const locale=useEditor(s=>s.locale),es=locale==='es';
 const [expanded,setExpanded]=useState(true);
 if(status!=='online')return null;
 return <aside className={`bt-presence-dock ${expanded?'':'collapsed'}`} aria-label={es?'Jugadores y ping de BuildTogether':'BuildTogether players and ping'}>
  <button type="button" className="bt-presence-title" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} title={es?'Participantes, ping y actividades':'Players, ping and activities'}>
   <Activity size={16}/><strong>Ping · BuildTogether</strong><span className="bt-presence-count">{members.length}</span>{expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
  </button>
  {expanded&&<>
   <div className="bt-presence-actions">
    <button type="button" onClick={()=>setBuildTogetherCameraVisibility(!show)} title={es?'Mostrar/ocultar cámaras flotantes':'Show/hide floating cameras'} aria-pressed={show}>{show?<Eye size={14}/>:<EyeOff size={14}/>} {es?'Cámaras':'Cameras'}</button>
    <button type="button" onClick={()=>setBuildTogetherViewCones(!cones)} disabled={!show} aria-pressed={cones} title={es?'Mostrar/ocultar dirección de mirada':'Show/hide view direction'}><Camera size={14}/> {es?'Mirada':'View'}</button>
   </div>
   <div className="bt-presence-members">
    {members.map(member=>{
     const self=member.id===selfId;const rtt=self?ping:member.pingMs;
     return <div className="bt-presence-person" key={member.id}>
      <div className="bt-presence-identity"><span className="bt-presence-dot" style={{background:member.color}}/><strong title={member.name}>{member.name}</strong>{self&&<small>{es?'(vos)':'(you)'}</small>}
       <span className="bt-presence-ping" title={es?'Ping al servidor anfitrión (RTT), no entre jugadores':'Round-trip ping to host server, not peer-to-peer'}><Activity size={12}/>Ping {rtt===null||rtt===undefined?'—':`${rtt} ms`}</span>
      </div>
      <div className="bt-presence-activity">{activityText(self?localActivity:member.activity,es)}{member.selection.length?` · ${member.selection.length} ${es?'selecc.':'selected'}`:''}</div>
      {!self&&<button type="button" className={`bt-presence-follow ${followId===member.id?'active':''}`} onClick={()=>setBuildTogetherFollow(followId===member.id?null:member.id)}>{followId===member.id?(es?'Dejar de seguir':'Stop following'):(es?'Seguir cámara':'Follow camera')}</button>}
     </div>;
    })}
   </div>
   <small className="bt-presence-note">{es?'Ping medido respecto al anfitrión':'Ping measured to host'}</small>
  </>}
 </aside>;
}

export function BuildTogetherPanel({onClose}:{onClose:()=>void}){
 const room=useBuildTogether(useShallow(s=>({status:s.status,host:s.host,code:s.code,role:s.role,selfId:s.selfId,participants:s.participants,locks:s.locks,followId:s.followId,error:s.error,pingMs:s.pingMs,jitterMs:s.jitterMs,reconnectAttempt:s.reconnectAttempt,pendingChanges:s.pendingChanges,revision:s.revision,lastSyncAt:s.lastSyncAt,hasRecoveryBackup:s.hasRecoveryBackup,conflictCount:s.conflictCount,lastConflict:s.lastConflict})));const locale=useEditor(s=>s.locale);const es=locale==='es';
 const [name,setName]=useState(()=>{try{return localStorage.getItem('svenstudio:buildtogether-name')||'Mapper'}catch{return 'Mapper'}});
 const [address,setAddress]=useState('127.0.0.1:49178');const [code,setCode]=useState('');
 const [spectator,setSpectator]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [notice,setNotice]=useState('');const [tab,setTab]=useState<'session'|'help'>('session');const session=room.status==='online'||room.status==='reconnecting';
 const execute=async(job:()=>Promise<void>)=>{setBusy(true);setError('');try{localStorage.setItem('svenstudio:buildtogether-name',name.trim());await job()}catch(e){setError(String(e instanceof Error?e.message:e))}finally{setBusy(false)}};
 const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setNotice(es?'Copiado.':'Copied.')}catch{setNotice(es?'Copialo manualmente.':'Please copy manually.')}};
 return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal-card buildtogether-dialog" role="dialog" aria-modal="true" aria-label="BuildTogether" onMouseDown={e=>e.stopPropagation()}>
  <div className="modal-title"><Users size={21}/><span>BuildTogether — Multiplayer Mapping</span><button type="button" onClick={onClose} title={es?'Cerrar':'Close'}><X size={17}/></button></div>
  <div className="bt-tabs" role="tablist" aria-label="BuildTogether navigation">
   <button type="button" role="tab" aria-selected={tab==='session'} className={tab==='session'?'active':''} onClick={()=>setTab('session')}><Users size={15}/>{es?'Sesión':'Session'}</button>
   <button type="button" role="tab" aria-selected={tab==='help'} className={tab==='help'?'active':''} onClick={()=>setTab('help')}><BookOpen size={15}/>{es?'Guía y conexión':'Help & connection'}</button>
   <span className={`bt-tab-health ${session?'connected':''}`}><span className="bt-health-dot"/>{session?(es?'En línea':'Online'):(es?'Desconectado':'Offline')}</span>
  </div>
  <div className="bt-scroll">{tab==='help'?<div className="bt-guide" role="tabpanel">
   <div className="bt-guide-intro"><BookOpen size={22}/><div><h3>{es?'Guía de BuildTogether':'BuildTogether guide'}</h3><p>{es?'Colaboración en tiempo real sin compartir archivos ni rutas locales.':'Real-time collaboration without sharing local files or paths.'}</p></div></div>
   <div className="bt-porthole-steps">
    <section><h4><Server size={16}/>{es?'1. Crear sesión (anfitrión)':'1. Host a session'}</h4><ol>
     <li>{es?'Abrí el mapa que querés compartir.':'Open the map to share.'}</li>
     <li>{es?'Para conectar por LAN o Porthole, ejecutá SvenStudio3D_BUILDTOGETHER_LAN.bat.':'For LAN or Porthole, launch SvenStudio3D_BUILDTOGETHER_LAN.bat.'}</li>
     <li>{es?'Creá una sesión desde la pestaña Sesión y copiá el código.':'Create a session from the Session tab and copy its code.'}</li>
     <li>{es?'Compartí la IP privada y el código solo con tus colaboradores.':'Privately share the network IP and code with collaborators.'}</li>
    </ol></section>
    <section><h4><UserPlus size={16}/>{es?'2. Unirse (invitado)':'2. Join a session'}</h4><ol>
     <li>{es?'Iniciá tu propia copia de SvenStudio3D.bat y abrí BuildTogether.':'Launch your own SvenStudio3D.bat and open BuildTogether.'}</li>
     <li>{es?'Ingresá la IP privada del anfitrión seguida del puerto TCP 49178.':'Enter the host private IP and TCP port 49178.'}</li>
     <li>{es?'Pegá el código de invitación y pulsá Conectar.':'Paste the invitation code and select Connect.'}</li>
     <li>{es?'Cada persona tiene su cámara, WAD y configuración de compilación.':'Each user retains their own camera, WADs, and compiler settings.'}</li>
    </ol></section>
   </div>
   <section className="bt-guide-card"><h4><Globe size={16}/>{es?'Conexión por Porthole':'Porthole connection'}</h4>
    <p>{es?'El anfitrión crea una sala de Porthole, comparte el puerto TCP 49178 y ejecuta SvenStudio3D_BUILDTOGETHER_LAN.bat. El invitado acepta el puerto compartido y utiliza la dirección de red virtual que muestre Porthole, seguida de :49178. No se necesita abrir el puerto al Internet público.':'The host creates a Porthole room, shares TCP port 49178 and launches SvenStudio3D_BUILDTOGETHER_LAN.bat. The guest accepts the shared port and uses the virtual network address displayed by Porthole, followed by :49178. Do not expose the port publicly.'}</p>
    <div className="bt-example"><code>192.168.1.17:49178</code><button type="button" onClick={()=>void copy('192.168.1.17:49178')}><Copy size={14}/>{es?'Copiar ejemplo':'Copy example'}</button></div>
    <small>{es?'Dirección solo de ejemplo; usá la IP que corresponda al anfitrión.':'Example only; use the host’s actual address.'}</small>
   </section>
   <section className="bt-guide-card"><h4><CheckCircle2 size={16}/>{es?'Qué se sincroniza':'What synchronizes'}</h4>
    <p>{es?'BuildTogether 3.5 sincroniza brushes, entidades, transformaciones, texturas y metadatos independientes por estudio (terrenos, arquitectura, NPC personalizados, cámaras y superficies). Los cambios se confirman por el servidor en orden.':'BuildTogether 3.5 syncs brushes, entities, transforms, textures and independent studio metadata (terrain, architecture, custom NPCs, cameras and surfaces). Changes are server-acknowledged in order.'}</p>
    <p>{es?'Las vistas previas, recursos importados y ajustes locales de los estudios no se comparten. No se transfieren WAD, MDL, audio, FGD ni rutas de compilación.':'Studio previews, imported resources and local settings are not shared. WAD, MDL, audio, FGD and compiler paths are never transferred.'}</p>
   </section>
   <div className="bt-porthole-warning"><AlertTriangle size={17}/><div><strong>{es?'Seguridad y recuperación':'Security and recovery'}</strong><p>{es?'Usá una red privada y personas de confianza. Guardá copias del mapa antes de compartir. Si se interrumpe la conexión, descargá la copia de recuperación antes de continuar.':'Use a private network and trusted collaborators. Back up your map first. If the connection drops, download any recovery copy before continuing.'}</p></div></div>
   {notice&&<p role="status" className="bt-hint">{notice}</p>}
   <button type="button" className="bt-guide-back" onClick={()=>setTab('session')}><ChevronRight size={16}/>{es?'Volver a sesión':'Back to session'}</button>
  </div>:<div role="tabpanel" className="bt-session-content">
   <p className="modal-subtext">{es?'Construyan el mismo mapa desde varios navegadores. Cada participante mantiene su propia cámara, WADs, FGD y rutas de compilación.':'Build the same map from different browsers. Each mapper keeps their own camera, WADs, FGD, and build paths.'}</p>
   <div className="bt-state"><span className={session?'bt-online':'bt-offline'}>{session?<Wifi size={16}/>:<WifiOff size={16}/>} {room.status==='online'?(es?'Conectado':'Connected'):room.status==='reconnecting'?(es?'Reconectando...':'Reconnecting...'):room.status==='connecting'?(es?'Conectando...':'Connecting...'):(es?'Sin sesión':'Not connected')}</span>{session&&<strong>{room.participants.length}/6</strong>}</div>
   {!session? <>
    <label>{es?'Tu nombre':'Your name'}<input value={name} maxLength={28} onChange={e=>setName(e.target.value)}/></label>
    <div className="bt-columns">
     <section className="bt-section"><h4><ShieldCheck size={17}/>{es?'Crear sesión':'Host session'}</h4>
      <p>{es?'Compartís el mapa abierto. Solo este equipo conserva las rutas y controla la compilación.':'Shares the current map. Your computer keeps the local paths and controls compilation.'}</p>
      <button className="primary-action" type="button" disabled={busy||room.status==='connecting'} onClick={()=>void execute(()=>createBuildTogether(name))}>{es?'Crear sesión':'Create session'}</button>
     </section>
     <section className="bt-section"><h4><UserPlus size={17}/>{es?'Unirse':'Join session'}</h4>
      <label>{es?'IP del anfitrión / red virtual':'Host / virtual LAN address'}<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="192.168.1.20:49178"/></label>
      <label>{es?'Código de invitación':'Invitation code'}<input value={code} onChange={e=>setCode(e.target.value)} placeholder="36-character code"/></label>
      <label className="bt-check"><input type="checkbox" checked={spectator} onChange={e=>setSpectator(e.target.checked)}/>{es?'Solo observar':'Spectator (read-only)'}</label>
      <button className="primary-action" type="button" disabled={busy||!code.trim()||room.status==='connecting'} onClick={()=>void execute(()=>joinBuildTogether(address,code,name,{spectator}))}>{es?'Conectar':'Connect'}</button>
     </section>
    </div>
   </>:<>
    <div className="bt-info"><div><small>{es?'Código de sesión':'Session code'}</small><code>{room.code}</code></div><button onClick={()=>void copy(room.code)} title={es?'Copiar código':'Copy code'}><Copy size={15}/></button></div>
    <div className="bt-network" aria-label="BuildTogether network diagnostics">
     <span><Activity size={15}/>{room.pingMs===null?'RTT —':`RTT ${room.pingMs} ms`}</span>
     <span>{es?'Variación':'Jitter'} {room.jitterMs===null?'—':`${room.jitterMs} ms`}</span>
     <span>{room.pendingChanges>0?(es?`Sincronizando ${room.pendingChanges} cambios`:`Syncing ${room.pendingChanges} changes`):(es?'Cambios sincronizados':'Changes synced')}</span>
     <span>{es?'Revisión':'Revision'} #{room.revision}</span>
     {room.lastSyncAt>0&&<span title={new Date(room.lastSyncAt).toLocaleString()}>{es?'Última confirmación':'Last acknowledgement'}: {new Date(room.lastSyncAt).toLocaleTimeString()}</span>}
    </div>
    {room.conflictCount>0&&<div className="bt-hint bt-warning" role="alert"><AlertTriangle size={16}/><span>{es?`Conflictos detectados: ${room.conflictCount}. Se guardó una copia de recuperación antes de priorizar el estado del servidor.`:`Conflicts detected: ${room.conflictCount}. A recovery copy was saved before prioritizing server state.`}<br/>{room.lastConflict}</span></div>}
    {room.status==='reconnecting'&&<div className="bt-hint bt-warning"><RefreshCw size={16}/>{es?`Conexión interrumpida; reconexión automática (${room.reconnectAttempt}/8). No edites el mapa hasta volver a conectar: los cambios sin confirmar se respaldan antes de restaurar el estado del servidor.`:`Connection interrupted; automatically reconnecting (${room.reconnectAttempt}/8). Avoid edits until connected. Unconfirmed changes are backed up before server resync.`}</div>}
    {room.host&&<div className="bt-hint"><Globe size={16}/>{es?'Para que otros entren por LAN o Porthole, iniciá el editor con el acceso BuildTogether LAN y compartí tu IP de esa red más este código. Puerto TCP 49178.':'For LAN or Porthole, launch with the BuildTogether LAN shortcut, then share your virtual network IP and this code. TCP port 49178.'}</div>}
    <section className="bt-members"><h4>{es?'Participantes':'Participants'}</h4>
     {room.participants.map(member=><div className="bt-member" key={member.id}><span className="bt-color" style={{background:member.color}}/><strong>{member.name}</strong>{member.id===room.selfId?<small>({es?'vos':'you'})</small>:null}<small>{member.role}</small><span className="bt-selected">{member.id!==room.selfId?`${activityText(member.activity,es)} · ${member.pingMs??'—'} ms · `:''}{member.selection.length?`${member.selection.length} ${es?'seleccionados':'selected'}`:''}</span>{member.id!==room.selfId&&<button type="button" className="bt-follow" onClick={()=>setBuildTogetherFollow(room.followId===member.id?null:member.id)}>{room.followId===member.id?(es?'Dejar de seguir':'Unfollow'):(es?'Seguir cámara':'Follow camera')}</button>}</div>)}
    </section>
    <div className="bt-hint"><Lock size={16}/>{es?'Los objetos seleccionados por otro participante se bloquean mientras los edita. Los recursos WAD, MDL y sonidos no se transfieren automáticamente.':'Objects selected by another mapper are locked during editing. WAD, MDL and sound resources are not transferred.'}</div>
    <button type="button" className="bt-leave" onClick={()=>{leaveBuildTogether();setError('')}}>{es?'Salir de la sesión':'Leave session'}</button>
   </>}
   {room.hasRecoveryBackup&&<div className="bt-hint"><ShieldCheck size={16}/><span>{es?'Existe una copia de recuperación de cambios locales no confirmados.':'A recovery copy of unconfirmed local edits is available.'} <button type="button" className="bt-follow" onClick={()=>{if(!downloadBuildTogetherBackup())setError(es?'No se pudo descargar la copia.':'Recovery download failed.')}}>{es?'Descargar copia':'Download recovery copy'}</button></span></div>}
   {(error||room.error)&&<p className="bt-error" role="alert">{error||room.error}</p>}{notice&&<p className="bt-hint">{notice}</p>}
   <p className="bt-footnote">{es?'BuildTogether 3.5 (experimental): sincronización por estudio, detección de conflictos y copias de recuperación. Versiones anteriores se probaron con Porthole - Local Port Sharing; las cámaras de v3.1 ya se probaron con Porthole, pero la recuperación de terrenos de v3.5 requiere validación real. Guardá copias del mapa.':'BuildTogether 3.5 (experimental): per-studio synchronization, conflict detection and local recovery. Earlier versions were tested with Porthole - Local Port Sharing; v3.1 was tested on Porthole; v3.5 terrain streaming still needs real-world confirmation. Keep map backups.'}</p>
  </div>}</div>
 </section></div>;
}
/** Screen-space cursor layer. No 3D camera projection: each person can orbit freely. */
export function BuildTogetherCursors(){
 const status=useBuildTogether(s=>s.status);
 const participants=useBuildTogether(s=>s.participants);
 const cursors=useBuildTogether(s=>s.cursors);
 const selfId=useBuildTogether(s=>s.selfId);
 const frame=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{const el=frame.current?.closest('.viewport-frame');if(!el||status!=='online')return;
  let lastMeasure=0;const onMove=(event:Event)=>{const e=event as PointerEvent;const now=performance.now();if(now-lastMeasure<60)return;lastMeasure=now;const rect=el.getBoundingClientRect();if(rect.width&&rect.height)sendBuildTogetherCursor((e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height)};
  el.addEventListener('pointermove',onMove,{passive:true});return()=>el.removeEventListener('pointermove',onMove);
 },[status]);
 if(status!=='online')return null;
 return <div ref={frame} className="bt-cursor-layer" aria-hidden="true">{participants.filter(p=>p.id!==selfId&&cursors[p.id]).map(p=><div className="bt-cursor" key={p.id} style={{left:`${Math.max(0,Math.min(100,cursors[p.id].x*100))}%`,top:`${Math.max(0,Math.min(100,cursors[p.id].y*100))}%`,color:p.color}}><MousePointer2 size={19} fill={p.color} stroke="#102536"/><span style={{background:p.color}}>{p.name}</span></div>)}</div>;
}
