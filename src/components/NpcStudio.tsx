import {useEffect,useMemo,useState} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {Activity,AlertTriangle,CheckCircle2,ChevronRight,Crosshair,Flag,MapPin,PackagePlus,Route,Search,Shield,Skull,Users,X} from 'lucide-react';
import {loadModelByPath,StudioModel} from './ModelBrowser';
import type {StudioPreview} from '../engine/mdl';
import type {PointEntity,FgdClass,Vec3} from '../engine/types';
import {npcClasses,isNpcClass,isNpcOwner,traceNpcRoute,validateNpcLogic,DEFAULT_SPAWNER,type SpawnerOptions} from '../engine/npc';
import {parseFgd} from '../engine/fgd';
import {useEditor} from '../store';
import {useT} from '../i18n';

function AutoFrame({data}:{data:StudioPreview}){
  const {camera}=useThree();
  useEffect(()=>{
    const bounds=new THREE.Box3();
    for(const mesh of data.meshes)for(let i=0;i<mesh.positions.length;i+=3)
      bounds.expandByPoint(new THREE.Vector3(mesh.positions[i],mesh.positions[i+1],mesh.positions[i+2]));
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()).length();
    const distance=Math.max(65,size*1.4);
    camera.position.copy(center.clone().add(new THREE.Vector3(distance*.9,distance*.55,distance)));
    camera.lookAt(center);camera.updateProjectionMatrix();
  },[data,camera]);
  return null;
}
function NpcPreview({modelPath,gameDir}:{modelPath?:string;gameDir:string}){
  const t=useT();
  const [model,setModel]=useState<StudioPreview|null>(null),[error,setError]=useState('');
  useEffect(()=>{
    let alive=true;setModel(null);setError('');
    if(!gameDir||!modelPath){setError(t('Configure a game directory and load the FGD to preview NPCs.'));return;}
    loadModelByPath(gameDir,modelPath).then(value=>{if(alive)setModel(value)}).catch(err=>{if(alive)setError(String(err))});
    return()=>{alive=false};
  },[gameDir,modelPath,t]);
  if(error)return <div className="npc-preview-empty"><Skull size={28}/><span>{error}</span></div>;
  if(!model)return <div className="npc-preview-empty"><Activity size={24}/>{t('Loading model…')}</div>;
  return <div className="npc-model-canvas"><Canvas camera={{position:[95,75,125],fov:55,near:.1,far:50000}} dpr={[1,1.5]} gl={{antialias:true}}>
    <color attach="background" args={['#0c1930']}/><ambientLight intensity={1.6}/><directionalLight intensity={2.1} position={[100,150,160]}/>
    <StudioModel data={model}/><AutoFrame data={model}/><OrbitControls makeDefault enablePan enableZoom/>
  </Canvas></div>;
}
function Numeric({value,onChange,min,max,step=1}:{value:number;onChange:(n:number)=>void;min:number;max:number;step?:number}){
  return <input type="number" min={min} max={max} step={step} value={value} onChange={e=>{if(e.target.value!=='')onChange(e.target.valueAsNumber)}}/>;
}
export function NPCStudio({onClose}:{onClose:()=>void}){
  const t=useT(),objects=useEditor(s=>s.project.objects),classes=useEditor(s=>s.fgdClasses),loaded=useEditor(s=>s.fgdLoaded);
  const selected=useEditor(s=>s.selected),setSelected=useEditor(s=>s.setSelected),setResourceView=useEditor(s=>s.setResourceView);
  const setProp=useEditor(s=>s.setObjectProp),addEntity=useEditor(s=>s.addEntity),place=useEditor(s=>s.startNpcPlacement);
  const spawn=useEditor(s=>s.spawnFromNpc),waypointMode=useEditor(s=>s.startWaypointPlacement),appendLogs=useEditor(s=>s.appendLogs);
  const gameDir=useEditor(s=>s.settings.gameDir),setFgd=useEditor(s=>s.setFgd);
  const allNpcs=useMemo(()=>npcClasses(classes),[classes]);
  const [query,setQuery]=useState(''),[className,setClassName]=useState<string>('monster_zombie');
  const [options,setOptions]=useState<SpawnerOptions>(DEFAULT_SPAWNER);
  const [notice,setNotice]=useState('');
  const [fgdBusy,setFgdBusy]=useState(false);
  const [activeId,setActiveId]=useState<string|null>(null);
  const npcs=useMemo(()=>allNpcs.filter(c=>(c.name+' '+c.description).toLowerCase().includes(query.toLowerCase())).slice(0,500),[allNpcs,query]);
  const activeClass=classes.find(c=>c.name===className)||allNpcs[0];
  const owner=objects.find((o):o is PointEntity=>o.kind==='entity'&&o.id===(activeId||selected))||null;
  const npcOwner=owner&&isNpcOwner(owner.classname)?owner:(
    objects.find((candidate):candidate is PointEntity=>candidate.kind==='entity'&&isNpcOwner(candidate.classname)&&
      traceNpcRoute(objects,candidate.id).nodes.some(node=>node.id===(activeId||selected)))||null);
  const route=useMemo(()=>npcOwner?traceNpcRoute(objects,npcOwner.id):null,[objects,npcOwner]);
  const npcIssues=useMemo(()=>validateNpcLogic(objects),[objects]);
  const modelPath=npcOwner?.props.model||classes.find(c=>c.name===npcOwner?.classname)?.studio||classes.find(c=>c.name===npcOwner?.props.monstertype)?.studio||activeClass?.studio;
  const run=(fn:()=>void)=>{try{fn();setNotice('')}catch(error){setNotice(error instanceof Error?error.message:String(error))}};
  const loadFgd=async()=>{
    if(!gameDir){setNotice(t('Configure the game directory in Build Settings first.'));return;}
    setFgdBusy(true);
    try{
      const response=await fetch('/api/svengine/fgd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir})});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||`HTTP ${response.status}`)}
      const parsed=parseFgd(await response.text());
      if(!parsed.length)throw Error('No FGD classes were found.');
      setFgd(parsed);setNotice(`${parsed.length} FGD classes loaded.`);
    }catch(error){setNotice(String(error instanceof Error?error.message:error))}
    finally{setFgdBusy(false)}
  };
  const beginNpc=()=>{if(!activeClass)return;place(activeClass.name);onClose()};
  const createNow=()=>{if(!activeClass)return;run(()=>{
    const center:Vec3=npcOwner?[npcOwner.position[0]+48,npcOwner.position[1],npcOwner.position[2]]:[0,0,48];
    addEntity(activeClass,center);
    setNotice(`${activeClass.name}: ${center.join(' ')}`);
  })};
  const startRoute=()=>{
    if(!npcOwner)return setNotice(t('Select an NPC or squadmaker first.'));
    waypointMode(npcOwner.id);onClose();
  };
  const makeSpawner=()=>{
    if(!npcOwner||!isNpcClass(npcOwner.classname))return setNotice(t('Select an NPC first.'));
    run(()=>{spawn(npcOwner.id,options);setActiveId(null);appendLogs([`NPC Studio: squadmaker created for ${npcOwner.classname}.`])});
  };
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
  },[onClose]);
  const fgdField=(field:string)=>classes.find(c=>c.name===npcOwner?.classname)?.props[field];
  return <div className="modal-backdrop npc-backdrop" onMouseDown={onClose}>
    <section className="npc-shell" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('NPC & AI Studio')}>
      <header className="npc-top"><span className="npc-badge"><Skull size={20}/></span><div><strong>{t('NPC & AI Studio')}</strong><small>Svengine 5.x · monster_* · squadmaker · path_waypoint</small></div><span className="npc-top-count">{allNpcs.length} NPC · {objects.filter(o=>o.kind==='entity'&&o.classname==='path_waypoint').length} waypoints</span><button onClick={onClose} aria-label={t('Close')}><X size={20}/></button></header>
      <div className="npc-layout">
        <aside className="npc-library">
          <h3><Users size={16}/>{t('NPC Library')}</h3>
          <label className="npc-search"><Search size={15}/><input placeholder={t('Search NPCs…')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
          {!loaded&&<p className="npc-hint">{t('Starter list. Import sven-coop.fgd for full list.')}</p>}
          <button className="npc-load-fgd" onClick={loadFgd} disabled={fgdBusy}>{fgdBusy?'…':t('Load Sven Co-op FGD')}</button>
          <div className="npc-class-list">{npcs.map(c=><button key={c.name} className={className===c.name?'active':''} onClick={()=>setClassName(c.name)} title={c.description}>
            <Skull size={15}/><span><strong>{c.name}</strong><small>{c.description}</small></span><ChevronRight size={13}/>
          </button>)}</div>
          <div className="npc-action-bar"><button onClick={beginNpc} disabled={!activeClass}><MapPin size={15}/>{t('Place in 3D')}</button><button onClick={createNow} disabled={!activeClass} title={t('Create near the current selection')}><PackagePlus size={15}/>{t('Create')}</button></div>
          <p className="npc-hint">{t('Place in 3D lets you choose a surface with the mouse. NPC AI runs in Sven Co-op, not in this preview.')}</p>
        </aside>
        <main className="npc-main">
          <div className="npc-subhead"><strong><Crosshair size={16}/>{npcOwner?.classname||activeClass?.name||t('NPC Preview')}</strong><small>{modelPath||t('No model specified in FGD')}</small></div>
          <NpcPreview modelPath={modelPath} gameDir={gameDir}/>
          <div className="npc-route-heading"><Route size={18}/><div><strong>{t('NPC Waypoint Route')}</strong><small>{t('Real Svengine path_waypoint entities, linked by targetname/target and assigned via path_name.')}</small></div></div>
          <div className="npc-route-list">
            {npcOwner&&<button className="npc-route-entry owner" onClick={()=>{setSelected(npcOwner.id);setActiveId(npcOwner?.id||null)}}><Flag size={16}/><span>{npcOwner.classname}</span><small>{npcOwner.props.path_name||t('No path assigned')}</small></button>}
            {route?.nodes.map((wp,i)=><button className="npc-route-entry" key={wp.id} onClick={()=>{setSelected(wp.id);setActiveId(npcOwner?.id||null)}}><MapPin size={16}/><span>{i+1}. {wp.props.targetname||'path_waypoint'}</span><small>{wp.position.join(', ')}</small></button>)}
            {!route?.nodes.length&&<p className="npc-hint">{t('Select a placed NPC or squadmaker to create its route.')}</p>}
          </div>
          {route?.brokenTarget&&<p className="npc-warn"><AlertTriangle size={15}/> Missing waypoint: {route.brokenTarget}</p>}
          {route?.loop&&<p className="npc-hint">{t('Loop detected. New waypoints must be inserted manually.')}</p>}
          <button className="npc-primary" disabled={!npcOwner||!!route?.brokenTarget||!!route?.loop} onClick={startRoute}><MapPin size={16}/>{t('Add waypoint in 3D')}</button>
        </main>
        <aside className="npc-inspector">
          <h3><Shield size={16}/>{t('NPC Inspector')}</h3>
          {npcOwner?<>
            <div className="npc-inspector-entity"><strong>{npcOwner.classname}</strong><small>{npcOwner.name}</small></div>
            {['targetname','health','weapons','head','classify','netname','path_name','guard_ent','model','spawnflags'].filter(key=>key==='targetname'||npcOwner.props[key]!==undefined||fgdField(key)).map(key=>{
              const field=fgdField(key);const value=npcOwner.props[key]??field?.defaultValue??'';
              return <label key={`${npcOwner.id}:${key}`} className="npc-input"><span>{field?.label||key} <small>{key}</small></span>
                {field?.type==='choices'&&field.options?.length?<select value={value} onChange={e=>setProp(npcOwner.id,key,e.target.value)}>{field.options.map(o=><option key={o.value} value={o.value}>{o.label} ({o.value})</option>)}</select>:
                  <input value={value} onChange={e=>setProp(npcOwner.id,key,e.target.value)}/>}</label>;
            })}
            <h3><Users size={15}/>{t('Squadmaker / Spawning')}</h3>
            {isNpcClass(npcOwner.classname)?<>
              <label className="npc-input"><span>{t('Monster count')} (-1 = ∞)</span><Numeric min={-1} max={10000} value={options.monstercount} onChange={monstercount=>setOptions(x=>({...x,monstercount}))}/></label>
              <label className="npc-input"><span>{t('Delay between spawns')} (s)</span><Numeric min={0} max={3600} step={.5} value={options.delay} onChange={delay=>setOptions(x=>({...x,delay}))}/></label>
              <label className="npc-input"><span>{t('Max live children')} (-1 = ∞)</span><Numeric min={-1} max={1024} value={options.maxLive} onChange={maxLive=>setOptions(x=>({...x,maxLive}))}/></label>
              <label className="npc-check"><input type="checkbox" checked={options.startOn} onChange={e=>setOptions(x=>({...x,startOn:e.target.checked}))}/>{t('Start on')}</label>
              <button className="npc-primary" onClick={makeSpawner}><PackagePlus size={16}/>{t('Create squadmaker')}</button>
              <p className="npc-hint">{t('Creates a real squadmaker near the NPC. You can move it using G. Auto Size BBox is enabled.')}</p>
            </>:<p className="npc-hint">{t('Select a monster_ entity to create a spawner.')}</p>}
          </>:<p className="npc-hint">{t('Select an existing NPC in Explorer or on the map to edit it here.')}</p>}
          <h3><Activity size={15}/>{t('NPC Validation')}</h3>
          <div className="npc-issues">{npcIssues.length?npcIssues.slice(0,16).map((issue,i)=><button key={i} className={`npc-issue ${issue.severity}`} onClick={()=>issue.entityId&&setSelected(issue.entityId)}><AlertTriangle size={14}/>{issue.message}</button>):<p className="npc-ok"><CheckCircle2 size={16}/>{t('No NPC path or spawner errors detected.')}</p>}</div>
        </aside>
      </div>
      <footer className="npc-footer"><span><Shield size={13}/>{t('Uses supported Sven Co-op keyvalues. No simulated AI.')}</span><span aria-live="polite">{notice}</span></footer>
    </section>
  </div>;
}
