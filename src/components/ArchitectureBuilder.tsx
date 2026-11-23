import {useEffect,useMemo,useState} from 'react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {defaultArchitecture,architectureOpeningMetrics,createArchitecture,type ArchitectureKind,type ArchitectureOptions} from '../engine/architecture';
import {defaultTerrain} from '../engine/terrain';
import {BrushPreview} from './BrushPreview';
import {KitSection} from './KitGallery';
import {MousePointer2,Crosshair} from 'lucide-react';
import type {Brush,Project,Vec3} from '../engine/types';

const kinds:ArchitectureKind[]=['room','corridor','stairs','landingStairs','spiralStairs','arch','frame','ramp','column','platform','bridge'];
// English source keys, translated with t() (v2.4).
const labels:Record<string,string>={room:'Room',corridor:'Open corridor',stairs:'Stairs',landingStairs:'Stairs + landing',spiralStairs:'Spiral stairs',
  arch:'Arch',frame:'Frame',ramp:'Ramp',column:'Column',platform:'Platform with supports',bridge:'Bridge with railings'};
const fields:{key:'width'|'height'|'depth'|'frame'|'steps';label:string;min:number;max:number}[]=[
  {key:'width',label:'Width (X)',min:8,max:8192},
  {key:'depth',label:'Length / depth (Y)',min:1,max:8192},
  {key:'height',label:'Height (Z)',min:8,max:8192},
  {key:'frame',label:'Thickness',min:1,max:128},
  {key:'steps',label:'Steps / segments',min:1,max:64}];
const field=(label:string,value:number,onChange:(v:number)=>void,step=1)=><label className="smart-arch-field">{label}
  <input type="number" value={Number.isFinite(value)?value:0} step={step} onChange={e=>onChange(Number(e.target.value))}/></label>;
const attempt=(fn:()=>void,done:()=>void,fail:(text:string)=>void)=>{
  try{fn();done()}catch(error){fail(error instanceof Error?error.message:String(error))}
};

// Zustand v5 / React 19 require referentially stable snapshots. In particular,
// never return a freshly allocated [] from a useEditor selector when a new map
// has no parametric openings or structures yet.
const EMPTY_OPENINGS:NonNullable<Project['architectureOpenings']>=[];
const EMPTY_ASSEMBLIES:NonNullable<Project['architectureAssemblies']>=[];

/** Mounted inside Shapes > Smart Build. This is not a second permanent dock. */
export function ArchitectureBuilder({onStart}:{onStart?:()=>void}={}){
  const t=useT();
  const [kind,setKind]=useState<ArchitectureKind>('room');
  const [options,setOptions]=useState<ArchitectureOptions>({...defaultArchitecture,width:256,depth:320,height:224});
  const [editOptions,setEditOptions]=useState<ArchitectureOptions>(defaultArchitecture);
  const [openingId,setOpeningId]=useState('');
  const [offset,setOffset]=useState(0),[sill,setSill]=useState(64);
  const [copies,setCopies]=useState(1),[gap,setGap]=useState(16);
  const [assemblyId,setAssemblyId]=useState('');
  const [assemblyOptions,setAssemblyOptions]=useState<ArchitectureOptions>(defaultArchitecture);
  const [origin,setOrigin]=useState<Vec3>([0,0,0]);
  const [message,setMessage]=useState('');
  const selected=useEditor(s=>s.selected);
  const storedOpenings=useEditor(s=>s.project.architectureOpenings);
  const storedAssemblies=useEditor(s=>s.project.architectureAssemblies);
  const openings=storedOpenings??EMPTY_OPENINGS;
  const assemblies=storedAssemblies??EMPTY_ASSEMBLIES;
  const build=useEditor(s=>s.buildArchitecture);
  const editOpening=useEditor(s=>s.editArchitectureOpening);
  const deleteOpening=useEditor(s=>s.removeArchitectureOpening);
  const detachWall=useEditor(s=>s.detachArchitectureWall);
  const repeatOpening=useEditor(s=>s.repeatArchitectureOpening);
  const editAssembly=useEditor(s=>s.editArchitectureAssembly);
  const deleteAssembly=useEditor(s=>s.deleteArchitectureAssembly);
  const detachAssembly=useEditor(s=>s.detachArchitectureAssembly);
  const chosenOpening=useMemo(()=>openings.find(o=>o.id===openingId)||openings.find(o=>o.memberIds.includes(selected||'')),[openings,openingId,selected]);
  const chosenAssembly=useMemo(()=>assemblies.find(a=>a.id===assemblyId)||assemblies.find(a=>a.memberIds.includes(selected||'')),[assemblies,assemblyId,selected]);
  useEffect(()=>{
    if(!chosenOpening)return;
    setEditOptions({...chosenOpening.options});
    const metrics=architectureOpeningMetrics(chosenOpening.wall,chosenOpening.kind,chosenOpening.options,chosenOpening.center);
    setOffset(metrics.offset);setSill(metrics.sill);
  },[chosenOpening?.id]);
  useEffect(()=>{
    if(!chosenAssembly)return;
    setAssemblyOptions({...chosenAssembly.options});setOrigin([...chosenAssembly.origin]);
  },[chosenAssembly?.id]);
  useEffect(()=>{
    const onError=(event:Event)=>setMessage((event as CustomEvent<string>).detail);
    window.addEventListener('svenstudio:architecture-error',onError);
    return()=>window.removeEventListener('svenstudio:architecture-error',onError);
  },[]);
  const set=<K extends keyof ArchitectureOptions>(k:K,n:ArchitectureOptions[K])=>setOptions(prev=>({...prev,[k]:n}));
  const setEdit=<K extends keyof ArchitectureOptions>(k:K,n:ArchitectureOptions[K])=>setEditOptions(prev=>({...prev,[k]:n}));
  const setAssembly=<K extends keyof ArchitectureOptions>(k:K,n:ArchitectureOptions[K])=>setAssemblyOptions(prev=>({...prev,[k]:n}));
  const finish=(text:string)=>{setMessage(t(text))};
  const errors=(e:string)=>setMessage('Error: '+t(e));
  const currentTexture=useEditor(s=>s.currentTexture);
  // Live preview of what "Generate" / "Place" will create (origin at the floor point).
  const preview=useMemo(()=>{
    try{return {brushes:createArchitecture(kind,options,null,currentTexture||'SV_BRICK01',undefined,[0,0,0]).objects.filter((o):o is Brush=>o.kind==='brush'),error:''};}
    catch(e){return {brushes:[] as Brush[],error:String(e instanceof Error?e.message:e)};}
  },[kind,options,currentTexture]);
  const place=()=>attempt(()=>{
    if(preview.error)throw Error(preview.error);
    useEditor.getState().startTerrainPlacement({kind:'structure',draft:{...defaultTerrain(),texture:currentTexture||'SV_BRICK01'},structure:{kind,options:{...options}}});
    onStart?.();
  },()=>setMessage(''),errors);
  return <div className="architecture-builder smart-architecture" data-smart-architecture="v1.5.17">
    <div className="category-label">Smart Architecture 2.0</div>
    <p className="panel-text">{t('Editable GoldSrc structures assembled from convex brushes. The parametric data stays in the project, not in the exported MAP.')}</p>
    <details open>
      <summary>{t('Create parametric structures')}</summary>
      <div className="architecture-kinds">{kinds.map(value=><button type="button" key={value} className={kind===value?'active':''}
        aria-pressed={kind===value} onClick={()=>{setKind(value);setMessage('');if(value==='spiralStairs'&&kind!=='spiralStairs')setOptions(prev=>({...prev,width:96,height:256,steps:16,frame:16,innerRadius:prev.innerRadius??32,turn:prev.turn??360,column:prev.column??true}))}}>{t(labels[value])}</button>)}</div>
      <div className="architecture-options">{fields.filter(f=>f.key!=='steps'||['stairs','landingStairs','spiralStairs','arch'].includes(kind)).filter(f=>f.key!=='depth'||kind!=='spiralStairs')
        .filter(f=>f.key!=='frame'||!['ramp','column','stairs'].includes(kind)).map(f=><label key={f.key}>{t(f.label)}<input type="number"
          min={f.min} max={f.max} step={1} value={options[f.key] as number}
          onChange={e=>set(f.key,e.target.valueAsNumber)}/></label>)}</div>
      {kind==='spiralStairs'&&<><div className="architecture-options">
        <label>{t('Inner radius')}<input type="number" min={0} max={2048} value={options.innerRadius??32} onChange={e=>set('innerRadius',e.target.valueAsNumber)}/></label>
        <label>{t('Total turn (°)')}<input type="number" min={45} max={1440} step={15} value={options.turn??360} onChange={e=>set('turn',e.target.valueAsNumber)}/></label>
      </div>
      <label className="shape-inline-check"><input type="checkbox" checked={!!options.clockwise} onChange={e=>set('clockwise',e.target.checked)}/>{t('Clockwise')}</label>
      <label className="shape-inline-check"><input type="checkbox" checked={options.column??true} onChange={e=>set('column',e.target.checked)}/>{t('Centre column')}</label>
      {options.height/Math.max(1,options.steps)>18&&<p className="architecture-error">{t('Steps over 18u need a jump.')}</p>}</>}
      {['room','corridor'].includes(kind)&&<label className="shape-inline-check"><input type="checkbox"
        checked={!!options.openTop} onChange={e=>set('openTop',e.target.checked)}/>{t('No roof')}</label>}
      <BrushPreview brushes={preview.brushes} label={preview.error?t(preview.error):`${preview.brushes.length} ${t('brushes')} · ${t('Drag to orbit; wheel to zoom.')}`}/>
      <div className="smart-arch-actions">
        <button type="button" className="soft-button" disabled={!!preview.error} onClick={place}><MousePointer2 size={14}/>{t('Place by clicking map')}</button>
        <button type="button" disabled={!!preview.error} title={t('Create it on the selected brush, or at the world origin without a selection.')} onClick={()=>attempt(()=>build(kind,options),()=>finish('Structure created. You can change it in Saved structures.'),errors)}><Crosshair size={14}/>{t('Create on selection')}</button>
      </div>
      <p className="panel-text">{t('Click a surface in the 3D view to place it; the structure follows the mouse first. Ctrl+Z undoes the whole structure.')}</p>
    </details>
    <KitSection studio="smart" summary={t('Buildings, corridors, roofs and mechanisms')} onStart={onStart}/>
    <details open={openings.length>0?undefined:false}>
      <summary>{t('Editable doors and windows')} ({openings.length})</summary>
      <p className="panel-text">{t('Create the opening from Architecture Mode (Doors and windows). Then change its size, position and count here.')}</p>
      {openings.length>0?<>
        <label className="smart-arch-selector">{t('Opening')}
          <select value={chosenOpening?.id||''} onChange={e=>{setOpeningId(e.target.value);setMessage('')}}>
            {openings.map((item,i)=><option key={item.id} value={item.id}>{i+1}. {item.kind==='door'?t('Door'):t('Window')} · {item.wall.name}</option>)}
          </select>
        </label>
        {chosenOpening&&<>
          <div className="architecture-options">
            {field(t('Width'),editOptions.width,n=>setEdit('width',n))}
            {field(t('Height'),editOptions.height,n=>setEdit('height',n))}
            {field(t('Side offset'),offset,setOffset)}
            {chosenOpening.kind==='window'&&field(t('Sill height from floor'),sill,setSill)}
            {!editOptions.cutOnly&&field(t('Frame thickness'),editOptions.frame,n=>setEdit('frame',n))}
            {!editOptions.cutOnly&&field(t('Frame depth'),editOptions.depth,n=>setEdit('depth',n))}
          </div>
          <label className="shape-inline-check"><input type="checkbox" checked={editOptions.cutOnly} onChange={e=>setEdit('cutOnly',e.target.checked)}/>{t('Hole only, no frame')}</label>
          {chosenOpening.kind==='door'&&<label className="shape-inline-check"><input type="checkbox" checked={editOptions.doorLeaf} onChange={e=>setEdit('doorLeaf',e.target.checked)}/>{t('Add a separate door leaf')}</label>}
          <div className="smart-arch-actions">
            <button type="button" className="soft-button" onClick={()=>attempt(()=>editOpening(chosenOpening.id,editOptions,offset,sill),()=>finish('Opening updated and wall rebuilt.'),errors)}>{t('Apply changes')}</button>
            <button type="button" onClick={()=>{if(!window.confirm(t('Remove this opening and rebuild the wall?')))return;
              attempt(()=>{deleteOpening(chosenOpening.id);setOpeningId('')},()=>finish('Opening removed; wall restored.'),errors)}}>{t('Remove opening')}</button>
          </div>
          <button className="smart-arch-detach" type="button" onClick={()=>{if(!window.confirm(t('Release every opening of this wall for manual editing? The brushes are kept.')))return;
            attempt(()=>detachWall(chosenOpening.id),()=>{setOpeningId('');finish('Wall detached; brushes kept.')},errors)}}>{t('Convert wall to normal brushes')}</button>
          <div className="smart-arch-copy">
            {field(t('Copies (max. 10)'),copies,n=>setCopies(Math.round(n)))}
            {field(t('Free gap'),gap,setGap)}
            <button type="button" onClick={()=>attempt(()=>repeatOpening(chosenOpening.id,copies,
              editOptions.width+2*(editOptions.cutOnly?0:editOptions.frame)+gap),()=>finish('Copies placed on the wall.'),errors)}>{t('Repeat along the wall')}</button>
          </div>
        </>}
      </>:<p className="panel-text">{t('There are no parametric openings in this map yet.')}</p>}
    </details>
    <details open={assemblies.length>0?undefined:false}>
      <summary>{t('Saved structures')} ({assemblies.length})</summary>
      {assemblies.length>0?<>
        <label className="smart-arch-selector">{t('Choose structure')}
          <select value={chosenAssembly?.id||''} onChange={e=>{setAssemblyId(e.target.value);setMessage('')}}>
            {assemblies.map((item,i)=><option key={item.id} value={item.id}>{i+1}. {labels[item.kind]?t(labels[item.kind]):item.kind} · {item.memberIds.length} {t('pieces')}</option>)}
          </select>
        </label>
        {chosenAssembly&&<>
          <div className="architecture-options">
            {fields.filter(f=>f.key!=='steps'||['stairs','landingStairs','spiralStairs','arch'].includes(chosenAssembly.kind)).map(f=><label key={f.key}>{t(f.label)}
              <input type="number" min={f.min} max={f.max} value={assemblyOptions[f.key] as number}
                onChange={e=>setAssembly(f.key,e.target.valueAsNumber)}/></label>)}
            {(['X','Y','Z'] as const).map((axis,i)=>field(`${t('Position')} ${axis}`,origin[i],n=>setOrigin(prev=>prev.map((v,j)=>j===i?n:v) as Vec3)))}
          </div>
          {['room','corridor'].includes(chosenAssembly.kind)&&<label className="shape-inline-check"><input type="checkbox"
            checked={!!assemblyOptions.openTop} onChange={e=>setAssembly('openTop',e.target.checked)}/>{t('No roof')}</label>}
          <div className="smart-arch-actions">
            <button type="button" className="soft-button" onClick={()=>attempt(()=>editAssembly(chosenAssembly.id,assemblyOptions,origin),()=>finish('Structure regenerated.'),errors)}>{t('Update structure')}</button>
            <button type="button" onClick={()=>attempt(()=>detachAssembly(chosenAssembly.id),()=>{setAssemblyId('');finish('Pieces released for individual editing.')},errors)}>{t('Convert to brushes')}</button>
            <button type="button" onClick={()=>{if(!window.confirm(t('Delete every piece of this structure?')))return;
              attempt(()=>deleteAssembly(chosenAssembly.id),()=>{setAssemblyId('');finish('Structure deleted.')},errors)}}>{t('Delete structure')}</button>
          </div>
        </>}
      </>:<p className="panel-text">{t('New structures can be resized, moved or converted to normal brushes here.')}</p>}
    </details>
    {message&&<p className={message.startsWith('Error:')?'architecture-error':'smart-arch-status'} role="status">{message}</p>}
    <p className="panel-text">{t('Changes can be undone with Ctrl+Z. If you edited a generated piece by hand, convert the structure to normal brushes first.')}</p>
  </div>;
}
