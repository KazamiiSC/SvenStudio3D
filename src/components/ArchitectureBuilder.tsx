import {useEffect,useMemo,useState} from 'react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {defaultArchitecture,architectureOpeningMetrics,type ArchitectureKind,type ArchitectureOptions} from '../engine/architecture';
import type {Project,Vec3} from '../engine/types';

const kinds:ArchitectureKind[]=['room','corridor','stairs','landingStairs','arch','frame','ramp','column','platform','bridge'];
const labels:Record<string,string>={room:'Habitación',corridor:'Pasillo abierto',stairs:'Escalera',landingStairs:'Escalera + descanso',
  arch:'Arco',frame:'Marco',ramp:'Rampa',column:'Columna',platform:'Plataforma con soportes',bridge:'Puente con barandas'};
const fields:{key:'width'|'height'|'depth'|'frame'|'steps';label:string;min:number;max:number}[]=[
  {key:'width',label:'Ancho (X)',min:8,max:8192},
  {key:'depth',label:'Largo / profundidad (Y)',min:1,max:8192},
  {key:'height',label:'Alto (Z)',min:8,max:8192},
  {key:'frame',label:'Espesor',min:1,max:128},
  {key:'steps',label:'Escalones / segmentos',min:1,max:64}];
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
export function ArchitectureBuilder(){
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
  const finish=(text:string)=>{setMessage(text)};
  const errors=(e:string)=>setMessage('Error: '+e);
  return <div className="architecture-builder smart-architecture" data-smart-architecture="v1.5.17">
    <div className="category-label">Smart Architecture 2.0</div>
    <p className="panel-text">Construcciones GoldSrc editables, ensambladas con brushes convexos. Los datos paramétricos quedan en el proyecto, no en el MAP exportado.</p>
    <details open>
      <summary>Crear estructuras paramétricas</summary>
      <div className="architecture-kinds">{kinds.map(value=><button type="button" key={value} className={kind===value?'active':''}
        aria-pressed={kind===value} onClick={()=>{setKind(value);setMessage('')}}>{labels[value]}</button>)}</div>
      <div className="architecture-options">{fields.filter(f=>f.key!=='steps'||['stairs','landingStairs','arch'].includes(kind))
        .filter(f=>f.key!=='frame'||!['ramp','column','stairs'].includes(kind)).map(f=><label key={f.key}>{f.label}<input type="number"
          min={f.min} max={f.max} step={1} value={options[f.key] as number}
          onChange={e=>set(f.key,e.target.valueAsNumber)}/></label>)}</div>
      {['room','corridor'].includes(kind)&&<label className="shape-inline-check"><input type="checkbox"
        checked={!!options.openTop} onChange={e=>set('openTop',e.target.checked)}/>Sin techo</label>}
      <button type="button" className="soft-button" onClick={()=>attempt(()=>build(kind,options),()=>finish('Estructura creada. Podés modificarla en la sección Estructuras guardadas.'),errors)}>
        Generar {labels[kind]||t('Create architecture')}</button>
      <p className="panel-text">Ubicación: centro del brush seleccionado o el origen si no seleccionaste ninguno. Ctrl+Z deshace toda la construcción.</p>
    </details>
    <details open={openings.length>0?undefined:false}>
      <summary>Puertas y ventanas editables ({openings.length})</summary>
      <p className="panel-text">Creá la abertura desde Formas → Arquitectura. Después podés cambiar sus medidas, posición y cantidad aquí.</p>
      {openings.length>0?<>
        <label className="smart-arch-selector">Abertura
          <select value={chosenOpening?.id||''} onChange={e=>{setOpeningId(e.target.value);setMessage('')}}>
            {openings.map((item,i)=><option key={item.id} value={item.id}>{i+1}. {item.kind==='door'?'Puerta':'Ventana'} · {item.wall.name}</option>)}
          </select>
        </label>
        {chosenOpening&&<>
          <div className="architecture-options">
            {field('Ancho',editOptions.width,n=>setEdit('width',n))}
            {field('Alto',editOptions.height,n=>setEdit('height',n))}
            {field('Desplazamiento lateral',offset,setOffset)}
            {chosenOpening.kind==='window'&&field('Antepecho desde suelo',sill,setSill)}
            {!editOptions.cutOnly&&field('Espesor de marco',editOptions.frame,n=>setEdit('frame',n))}
            {!editOptions.cutOnly&&field('Profundidad de marco',editOptions.depth,n=>setEdit('depth',n))}
          </div>
          <label className="shape-inline-check"><input type="checkbox" checked={editOptions.cutOnly} onChange={e=>setEdit('cutOnly',e.target.checked)}/>Solo hueco, sin marco</label>
          {chosenOpening.kind==='door'&&<label className="shape-inline-check"><input type="checkbox" checked={editOptions.doorLeaf} onChange={e=>setEdit('doorLeaf',e.target.checked)}/>Añadir hoja independiente</label>}
          <div className="smart-arch-actions">
            <button type="button" className="soft-button" onClick={()=>attempt(()=>editOpening(chosenOpening.id,editOptions,offset,sill),()=>finish('Abertura actualizada y pared reconstruida.'),errors)}>Aplicar cambios</button>
            <button type="button" onClick={()=>{if(!window.confirm('¿Quitar esta abertura y reconstruir la pared?'))return;
              attempt(()=>{deleteOpening(chosenOpening.id);setOpeningId('')},()=>finish('Abertura eliminada; pared restaurada.'),errors)}}>Eliminar abertura</button>
          </div>
          <button className="smart-arch-detach" type="button" onClick={()=>{if(!window.confirm('¿Liberar todas las aberturas de esta pared para edición manual? Se conservarán los brushes.'))return;
            attempt(()=>detachWall(chosenOpening.id),()=>{setOpeningId('');finish('Pared desvinculada; brushes conservados.')},errors)}}>Convertir pared a brushes normales</button>
          <div className="smart-arch-copy">
            {field('Copias (máx. 10)',copies,n=>setCopies(Math.round(n)))}
            {field('Separación libre',gap,setGap)}
            <button type="button" onClick={()=>attempt(()=>repeatOpening(chosenOpening.id,copies,
              editOptions.width+2*(editOptions.cutOnly?0:editOptions.frame)+gap),()=>finish('Copias colocadas en la pared.'),errors)}>Repetir sobre la pared</button>
          </div>
        </>}
      </>:<p className="panel-text">Todavía no hay aberturas paramétricas en este mapa.</p>}
    </details>
    <details open={assemblies.length>0?undefined:false}>
      <summary>Estructuras guardadas ({assemblies.length})</summary>
      {assemblies.length>0?<>
        <label className="smart-arch-selector">Elegir estructura
          <select value={chosenAssembly?.id||''} onChange={e=>{setAssemblyId(e.target.value);setMessage('')}}>
            {assemblies.map((item,i)=><option key={item.id} value={item.id}>{i+1}. {labels[item.kind]||item.kind} · {item.memberIds.length} piezas</option>)}
          </select>
        </label>
        {chosenAssembly&&<>
          <div className="architecture-options">
            {fields.filter(f=>f.key!=='steps'||['stairs','landingStairs','arch'].includes(chosenAssembly.kind)).map(f=><label key={f.key}>{f.label}
              <input type="number" min={f.min} max={f.max} value={assemblyOptions[f.key] as number}
                onChange={e=>setAssembly(f.key,e.target.valueAsNumber)}/></label>)}
            {(['X','Y','Z'] as const).map((axis,i)=>field(`Posición ${axis}`,origin[i],n=>setOrigin(prev=>prev.map((v,j)=>j===i?n:v) as Vec3)))}
          </div>
          {['room','corridor'].includes(chosenAssembly.kind)&&<label className="shape-inline-check"><input type="checkbox"
            checked={!!assemblyOptions.openTop} onChange={e=>setAssembly('openTop',e.target.checked)}/>Sin techo</label>}
          <div className="smart-arch-actions">
            <button type="button" className="soft-button" onClick={()=>attempt(()=>editAssembly(chosenAssembly.id,assemblyOptions,origin),()=>finish('Estructura regenerada.'),errors)}>Actualizar estructura</button>
            <button type="button" onClick={()=>attempt(()=>detachAssembly(chosenAssembly.id),()=>{setAssemblyId('');finish('Piezas liberadas para edición individual.')},errors)}>Convertir a brushes</button>
            <button type="button" onClick={()=>{if(!window.confirm('¿Eliminar todas las piezas de esta estructura?'))return;
              attempt(()=>deleteAssembly(chosenAssembly.id),()=>{setAssemblyId('');finish('Estructura eliminada.')},errors)}}>Eliminar estructura</button>
          </div>
        </>}
      </>:<p className="panel-text">Las estructuras nuevas se podrán redimensionar, mover o convertir a brushes normales.</p>}
    </details>
    {message&&<p className={message.startsWith('Error:')?'architecture-error':'smart-arch-status'} role="status">{message}</p>}
    <p className="panel-text">Los cambios son reversibles con Ctrl+Z. Si editaste manualmente una pieza generada, convertí primero la estructura a brushes normales.</p>
  </div>;
}
