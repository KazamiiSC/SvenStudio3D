import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {Layers3,Volume2,Sun,Clapperboard,AlertTriangle,CheckCircle2,Download,Save,Trash2,Brush as BrushIcon,Info} from 'lucide-react';
import {useEditor} from '../store';
import {SURFACE_PRESETS,SURFACE_CODES,inspectTextureAnimations,materialSoundPath,generateSurfaceMaterialsTxt,inspectSurfaceSounds,surfaceMaterialDoctor,type SurfacePresetId,type SurfaceSoundCode,type SurfaceSoundMap} from '../engine/materialSurface';
import type {Brush,TextureAsset} from '../engine/types';

type Tab='surface'|'sounds'|'emission'|'animation'|'doctor';
type SavedPreset={name:string;preset:SurfacePresetId;amount:number;color:[number,number,number];texture:string;paintAll:boolean};
const STORAGE='svenstudio:material-surface-presets:v1';
function loadSaved():SavedPreset[]{
 try{
  const data=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(!Array.isArray(data))return [];
  return data.slice(0,40).filter(p=>p&&typeof p.name==='string'&&p.preset in SURFACE_PRESETS&&Number.isInteger(p.amount)&&p.amount>0&&p.amount<256&&Array.isArray(p.color)&&p.color.length===3&&p.color.every((v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<256)&&typeof p.texture==='string'&&typeof p.paintAll==='boolean').map(p=>({...p,name:p.name.slice(0,48)}));
 }catch{return []}
}
function persist(list:SavedPreset[]){try{localStorage.setItem(STORAGE,JSON.stringify(list.slice(0,40)))}catch{/* Storage is optional */}}
function downloadPlain(name:string,content:string){
 const blob=new Blob([content],{type:'text/plain;charset=us-ascii'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const text={
 es:{title:'Material & Surface Studio',description:'Materiales nativos de Sven Co-op. El MAP conserva sus UV Valve 220.',surface:'Superficie',sounds:'Sonidos',emission:'Emisión',animation:'Animación',doctor:'Doctor',selected:'Brushes seleccionados',texture:'Textura WAD',paint:'Aplicar esta textura a TODAS las caras (no modifica UV)',amount:'Opacidad / intensidad (1–255)',color:'Color RGB',apply:'Convertir / aplicar preset',note:'Un modo de renderizado afecta a toda la entidad brush, no a una sola cara. Para vidrio solo en una cara, separá primero el brush.',sound:'Sonido de material para textura',save:'Asignar',clear:'Quitar',export:'Descargar materials.txt',link:'Enlazar worldspawn',path:'Instalá el archivo descargado en:',presets:'Presets guardados',presetName:'Nombre del preset',store:'Guardar preset',noBrush:'Seleccioná un brush en el visor 3D.',visual:'Vista previa aproximada',emissionText:'SC-RAD genera la luz real. El navegador no simula un material PBR.',power:'Brillo SC-RAD',emissionAction:'Crear light_surface',animationText:'Las animaciones +0...+9 y +A...+J deben existir dentro del WAD. Esta pestaña no edita archivos WAD.',doctorText:'Advertencias de compatibilidad: no modifica el mapa automáticamente.',warning:'Antes de distribuir el mapa, incluí el WAD y los archivos materials.txt necesarios.'},
 en:{title:'Material & Surface Studio',description:'Native Sven Co-op surfaces. MAP Valve 220 UV mapping stays intact.',surface:'Surface',sounds:'Sounds',emission:'Emission',animation:'Animation',doctor:'Doctor',selected:'Selected brushes',texture:'WAD texture',paint:'Paint ALL faces with this texture (UV unchanged)',amount:'Opacity / intensity (1–255)',color:'RGB color',apply:'Convert / apply preset',note:'Render modes affect the entire brush entity, not just one face. For single-face glass, separate the brush first.',sound:'Material sound for texture',save:'Assign',clear:'Remove',export:'Download materials.txt',link:'Link worldspawn',path:'Install the downloaded file at:',presets:'Saved presets',presetName:'Preset name',store:'Save preset',noBrush:'Select a brush in the 3D viewport.',visual:'Approximate preview',emissionText:'SC-RAD computes real emission. No PBR material is invented in the browser.',power:'SC-RAD brightness',emissionAction:'Create light_surface',animationText:'Animated frames +0...+9 and +A...+J must exist in the WAD. This tab does not modify WAD files.',doctorText:'Compatibility warnings: this tab never changes the MAP automatically.',warning:'When distributing a map, include the required WAD and materials.txt resources.'}
};
export function MaterialSurfaceStudio(){
 const locale=useEditor(s=>s.locale),tr=locale==='es'?text.es:text.en;
 const [tab,setTab]=useState<Tab>('surface'),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected),selectedIds=useEditor(s=>s.selectedIds),selectedFace=useEditor(s=>s.selectedFace);
 const textureAssets=useEditor(s=>s.textureAssets),currentTexture=useEditor(s=>s.currentTexture),project=useEditor(s=>s.project);
 const sounds:SurfaceSoundMap=useEditor(s=>s.project.surfaceSounds)||{};
 const mapName=useEditor(s=>s.settings.mapName);
 const apply=useEditor(s=>s.applyNativeSurfacePreset),assign=useEditor(s=>s.assignSurfaceSound),link=useEditor(s=>s.linkMaterialSounds),emissive=useEditor(s=>s.addEmissiveFromBrush);
 const [preset,setPreset]=useState<SurfacePresetId>('glass'),[amount,setAmount]=useState(180),[color,setColor]=useState<[number,number,number]>([255,255,255]);
 const [texture,setTexture]=useState(''),[paintAll,setPaintAll]=useState(false),[sound,setSound]=useState<SurfaceSoundCode>('M'),[brightness,setBrightness]=useState(80);
 const [saved,setSaved]=useState<SavedPreset[]>(loadSaved),[presetName,setPresetName]=useState(''),[filter,setFilter]=useState('');
 const brushes=useMemo(()=>{
  const ids=new Set(selectedIds);
  if(selected&&objects.some(o=>o.id===selected&&o.kind==='entity'))for(const o of objects)if(o.kind==='brush'&&o.entityId===selected)ids.add(o.id);
  return objects.filter((o):o is Brush=>o.kind==='brush'&&ids.has(o.id));
 },[objects,selectedIds,selected]);
 const selectedFaceTexture=brushes.length===1?brushes[0].faces[selectedFace??0]?.texture:undefined;
 useEffect(()=>{setTexture(selectedFaceTexture||brushes[0]?.faces[0]?.texture||currentTexture||'')},[selected,selectedFace]);
 useEffect(()=>{setSound((sounds[texture.toUpperCase()]||'M') as SurfaceSoundCode)},[texture,sounds]);
 const textureAsset:TextureAsset|undefined=textureAssets.find(a=>a.name.toUpperCase()===texture.trim().toUpperCase());
 const textureNames=useMemo(()=>[...new Set(textureAssets.map(a=>a.name.toUpperCase()))].sort(),[textureAssets]);
 const animations=useMemo(()=>inspectTextureAnimations(textureNames),[textureNames]);
 const doctor=useMemo(()=>surfaceMaterialDoctor(project,textureNames),[project,textureNames]);
 const assetChoices=useMemo(()=>textureNames.filter(n=>n.toLowerCase().includes(filter.toLowerCase())).slice(0,120),[filter,textureNames]);
 const applyAction=(fn:()=>void,success:string)=>{
  try{fn();setError('');setNotice(success)}catch(e){setError(e instanceof Error?e.message:String(e));setNotice('')}
 };
 const presetAction=()=>applyAction(()=>apply(brushes.map(o=>o.id),preset,{amount,color,paintAll,texture,waveHeight:1}),`${brushes.length} brush(es) · ${SURFACE_PRESETS[preset].classname} · Undo/Redo`);
 const addSaved=()=>{
  const name=presetName.trim().slice(0,48);if(!name){setError(locale==='es'?'Escribí un nombre.':'Enter a name.');return;}
  const updated=[...saved.filter(p=>p.name.toLowerCase()!==name.toLowerCase()),{name,preset,amount,color,paintAll,texture}].slice(-40);setSaved(updated);persist(updated);setPresetName('');setNotice(name);setError('');
 };
 const usePreset=(p:SavedPreset)=>{setPreset(p.preset);setAmount(p.amount);setColor([...p.color]);setPaintAll(p.paintAll);setTexture(p.texture)};
 let filePath='';try{filePath=materialSoundPath(mapName)}catch{filePath='sound/<mapname>/<mapname>_materials.txt'}
 const materialText=useMemo(()=>{try{return generateSurfaceMaterialsTxt(sounds)}catch{return ''}},[sounds]);
 const invalidSounds=inspectSurfaceSounds(sounds);
 const button=(name:Tab,label:string,icon:ReactNode)=><button type="button" key={name} className={tab===name?'active':''} onClick={()=>{setTab(name);setError('');setNotice('')}} title={label}>{icon}<span>{label}</span></button>;
 return <section className="material-studio assets-scroll" aria-label={tr.title}>
  <div className="material-head"><Layers3 size={17}/><strong>{tr.title}</strong></div>
  <p className="material-note">{tr.description}</p>
  <div className="material-tabs">
   {button('surface',tr.surface,<BrushIcon size={15}/>)}{button('sounds',tr.sounds,<Volume2 size={15}/>)}{button('emission',tr.emission,<Sun size={15}/>)}{button('animation',tr.animation,<Clapperboard size={15}/>)}{button('doctor',tr.doctor,<Info size={15}/>)}
  </div>
  {(tab==='surface'||tab==='sounds'||tab==='emission')&&<>
   <label className="material-field">{tr.texture}<input value={texture} maxLength={15} spellCheck={false} onChange={e=>setTexture(e.target.value.toUpperCase())} placeholder="WAD_TEXTURE"/></label>
   {textureAssets.length>0&&<details className="material-assets"><summary>{locale==='es'?'Elegir de WAD cargados':'Pick from loaded WADs'} ({textureAssets.length})</summary><input placeholder={locale==='es'?'Filtrar...':'Filter...'} value={filter} onChange={e=>setFilter(e.target.value)}/><div className="material-asset-list">{assetChoices.map(name=><button type="button" key={name} onClick={()=>{setTexture(name);setFilter('')}}>{name}</button>)}</div></details>}
   {textureAsset&&<div className="material-swatch"><img src={textureAsset.thumbUrl||textureAsset.dataUrl} alt={textureAsset.name}/><div><strong>{textureAsset.name}</strong><small>{textureAsset.width}×{textureAsset.height}</small><small>{textureAsset.wad}</small></div></div>}
  </>}
  {tab==='surface'&&<>
   <div className="material-selected"><span>{tr.selected}</span><strong>{brushes.length}</strong></div>
   {brushes.length===0&&<p className="material-alert">{tr.noBrush}</p>}
   <div className="material-preset-list">{(Object.entries(SURFACE_PRESETS) as [SurfacePresetId,(typeof SURFACE_PRESETS)[SurfacePresetId]][]).map(([key,p])=><button type="button" className={preset===key?'active':''} key={key} onClick={()=>{setPreset(key);setAmount(p.amount)}}><strong>{p.label}</strong><small>{p.classname} · rendermode {p.mode}</small></button>)}</div>
   <p className="material-note">{SURFACE_PRESETS[preset].description}</p>
   <label className="material-check"><input type="checkbox" checked={paintAll} onChange={e=>setPaintAll(e.target.checked)}/>{tr.paint}</label>
   <label className="material-field">{tr.amount}<input type="number" min={1} max={255} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
   <div className="material-field"><span>{tr.color}</span><div className="material-rgb">{color.map((value,i)=><input key={i} type="number" title={['Red','Green','Blue'][i]} min={0} max={255} value={value} onChange={e=>setColor(old=>old.map((c,j)=>i===j?Number(e.target.value):c) as [number,number,number])}/>)}</div></div>
   <div className="material-visual"><strong>{tr.visual}</strong><div className="material-preview-box" style={{background:`rgb(${color.join(',')})`,opacity:amount/255}}/><small>{SURFACE_PRESETS[preset].classname} · {amount}/255</small></div>
   <button className="material-primary" disabled={!brushes.length} onClick={presetAction}><CheckCircle2 size={15}/>{tr.apply}</button>
   <p className="material-note">{tr.note}</p>
   <div className="material-subhead"><Save size={14}/>{tr.presets}</div>
   <div className="material-inline"><input value={presetName} maxLength={48} onChange={e=>setPresetName(e.target.value)} placeholder={tr.presetName}/><button title={tr.store} onClick={addSaved}><Save size={15}/></button></div>
   {saved.map(p=><div className="material-save-row" key={p.name}><button onClick={()=>usePreset(p)} title="Load preset">{p.name} <small>({p.preset})</small></button><button title="Delete preset" onClick={()=>{const remaining=saved.filter(x=>x.name!==p.name);setSaved(remaining);persist(remaining)}}><Trash2 size={14}/></button></div>)}
  </>}
  {tab==='sounds'&&<>
   <p className="material-note">Sven Co-op: <code>materials.txt</code> · ASCII · {locale==='es'?'máximo 12 caracteres de comparación':'12-character matching'}.</p>
   <label className="material-field">{tr.sound}<select value={sound} onChange={e=>setSound(e.target.value as SurfaceSoundCode)}>{Object.entries(SURFACE_CODES).map(([code,label])=><option key={code} value={code}>{code} · {label}</option>)}</select></label>
   <div className="material-inline"><button className="material-primary" onClick={()=>applyAction(()=>assign(texture,sound),`${texture} → ${sound}`)}>{tr.save}</button><button onClick={()=>applyAction(()=>assign(texture,null),`${texture} removed`)}>{tr.clear}</button></div>
   <div className="material-sound-entries">{Object.entries(sounds).sort(([a],[b])=>a.localeCompare(b)).map(([name,code])=><div className="material-save-row" key={name}><span><b>{code}</b> {name}</span><button onClick={()=>applyAction(()=>assign(name,null),`${name} removed`)} aria-label={`Remove ${name}`}><Trash2 size={13}/></button></div>)}</div>
   {invalidSounds.map(s=><p className="material-alert" key={s}>{s}</p>)}
   <p className="material-note">{tr.path}<code>{filePath}</code></p>
   <button className="soft-button" disabled={!materialText.trim()} onClick={()=>downloadPlain(`${mapName}_materials.txt`,materialText)}><Download size={14}/>{tr.export}</button>
   <button className="soft-button" disabled={!materialText.trim()} onClick={()=>applyAction(()=>link(mapName),`worldspawn.materials_file = ${filePath}`)}>{tr.link}</button>
   <p className="material-note">{locale==='es'?'Descargá e instalá el TXT en svencoop_addon/ o svencoop/. El botón enlaza la ruta en worldspawn; no copia archivos automáticamente.':'Install the downloaded TXT in svencoop_addon/ or svencoop/. Linking changes worldspawn only; it does not install files automatically.'}</p>
  </>}
  {tab==='emission'&&<>
   <p className="material-note">{tr.emissionText}</p>
   <label className="material-field">{tr.power}<input type="number" min="1" max="100000" value={brightness} onChange={e=>setBrightness(Number(e.target.value))}/></label>
   <button className="material-primary" disabled={brushes.length!==1} onClick={()=>applyAction(()=>emissive(brushes[0].id,texture,brightness),`light_surface · ${texture}`)}><Sun size={15}/>{tr.emissionAction}</button>
   <p className="material-note">{locale==='es'?'Usá Lighting Studio para editar el color, alcance y estilo de light_surface. Recompilá con SC-RAD.':'Use Lighting Studio to edit light_surface color, range and style. Rebuild with SC-RAD.'}</p>
  </>}
  {tab==='animation'&&<>
   <p className="material-note">{tr.animationText}</p>
   {animations.length===0?<p className="material-note">{locale==='es'?'No se encontraron secuencias animadas en los WAD importados.':'No animated sequences found in imported WADs.'}</p>:animations.map(g=><div key={g.base} className="material-animation"><strong>{g.base}</strong><small>+0…+9: {g.regular.join(', ')||'—'} · +A…+J: {g.alternate.join(', ')||'—'}</small>{g.missing.length>0&&<p className="material-alert"><AlertTriangle size={13}/>{g.missing.join(', ')}</p>}</div>)}
  </>}
  {tab==='doctor'&&<><p className="material-note">{tr.doctorText}</p>{doctor.length===0?<p className="material-good"><CheckCircle2 size={15}/>No warnings detected.</p>:doctor.map((w,i)=><div className="material-warning" key={i}><AlertTriangle size={15}/><span>{w}</span></div>)}</>}
  {(error||notice)&&<p role="status" className={error?'material-alert':'material-good'}>{error||notice}</p>}
  <p className="material-footer">{tr.warning}</p>
 </section>;
}
