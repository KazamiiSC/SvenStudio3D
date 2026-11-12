/** MDL library for BSP entity editing. Read-only inventory; assignment is an explicit user action. */
import {useEffect,useState,useRef,useMemo} from 'react';
import {Package,Search,RefreshCw,Eye,Plus,X,AlertTriangle,Grid2X2,List,Shield,UserRound,MousePointer2} from 'lucide-react';
import {ModelPreviewModal,ModelThumb,postModelJson,type ModelFile} from './ModelBrowser';
import {useT} from '../i18n';
import type {StudioPreview} from '../engine/mdl';
import {loadLocalBspModels} from './BspLocalModels';
import {bspModelEntitySpec,bspRecommendedNpcClass,defaultBspModelSettings,type BspModelEntitySpec,type BspModelPlacementSettings,type BspModelPlacementMode} from '../engine/bspModelPlacement';
export function BspModelLibrary({gameDir,onClose,onAssign,onPlace,onConvert,canAssign,canConvert,npcClasses,onImportLocal,localModels}:{
  gameDir:string;canAssign:boolean;canConvert:boolean;
  npcClasses:readonly {name:string;description:string}[];
  onClose:()=>void;onAssign:(path:string)=>void;
  onPlace:(spec:BspModelEntitySpec)=>void;onConvert:(spec:BspModelEntitySpec)=>void;
  onImportLocal:(models:Map<string,StudioPreview>)=>void;localModels:ReadonlyMap<string,StudioPreview>
}){
  const t=useT();
  const [query,setQuery]=useState('');
  const [settings,setSettings]=useState<BspModelPlacementSettings>({...defaultBspModelSettings});
  const updateSetting=<K extends keyof BspModelPlacementSettings>(key:K,value:BspModelPlacementSettings[K])=>setSettings(old=>({...old,[key]:value}));
  const allowedNpcClassnames=useMemo(()=>[...new Set(['monster_generic',...npcClasses.map(c=>c.name)])],[npcClasses]);
  const [grid,setGrid]=useState(()=>{try{return localStorage.getItem('svstudio-bsp-model-grid')==='true'}catch{return false}});
  const setView=(next:boolean)=>{setGrid(next);try{localStorage.setItem('svstudio-bsp-model-grid',String(next))}catch{/* Private browsing. */}};
  const [items,setItems]=useState<ModelFile[]>([]);
  const [total,setTotal]=useState(0);
  const [selected,setSelected]=useState<ModelFile|null>(null);
  const chooseModel=(item:ModelFile)=>{
    setSelected(item);
    const suggested=bspRecommendedNpcClass(item.path,allowedNpcClassnames);
    if(suggested)setSettings(current=>({...current,npcClassname:suggested}));
  };
  const suggestedNpc=selected?bspRecommendedNpcClass(selected.path,allowedNpcClassnames):null;
  const modelSpec=useMemo(()=>{
    if(!selected)return {spec:null,error:''};
    try{return {spec:bspModelEntitySpec(selected.path,settings,allowedNpcClassnames),error:''}}
    catch(error){return {spec:null,error:String(error instanceof Error?error.message:error)}}
  },[selected,settings,allowedNpcClassnames]);
  const [preview,setPreview]=useState<ModelFile|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const folderInput=useRef<HTMLInputElement>(null);
  const [folderBusy,setFolderBusy]=useState(false);
  const [folderNotice,setFolderNotice]=useState('');
  useEffect(()=>{folderInput.current?.setAttribute('webkitdirectory','');folderInput.current?.setAttribute('directory','')},[]);
  const localList=useMemo(()=>[...localModels.keys()].filter(path=>path.toLowerCase().includes(query.toLowerCase())).map(path=>({path,name:path.split('/').at(-1)||path,source:'session'} as ModelFile)),[localModels,query]);
  useEffect(()=>{
    if(!gameDir){setError(t('Configure Sven Co-op game directory to load MDL models.'));setItems([]);return}
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>{
      setBusy(true);setError('');
      void postModelJson('/api/assets/models',{gameDir,query,limit:300,refresh:refresh>0},controller.signal)
        .then((data:{items:ModelFile[];total:number})=>{if(!controller.signal.aborted){setItems(data.items);setTotal(data.total)}})
        .catch(cause=>{if(!controller.signal.aborted)setError(String(cause))})
        .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
    },refresh?0:250);
    return()=>{controller.abort();window.clearTimeout(timeout)};
  },[gameDir,query,refresh,t]);
  return <div className="bsp-library-backdrop" onMouseDown={onClose}>
    <section className="bsp-library" role="dialog" aria-modal="true" aria-label={t('BSP model library')} onMouseDown={event=>event.stopPropagation()}>
      <header><div><strong><Package size={18}/>{t('BSP model library')}</strong><small>{t('MDL models installed in Sven Co-op')} · {total + localList.length}</small></div><button onClick={onClose} aria-label={t('Close')}><X size={18}/></button></header>
      <div className="bsp-library-search"><Search size={16}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Search models by path or name')}/>
        <div className="bsp-library-view-switch" role="group" aria-label={t('Model display mode')}>
          <button aria-label={t('List view')} title={t('List view')} aria-pressed={!grid} className={!grid?'active':''} onClick={()=>setView(false)}><List size={16}/></button>
          <button aria-label={t('Grid thumbnails')} title={t('Grid thumbnails')} aria-pressed={grid} className={grid?'active':''} onClick={()=>setView(true)}><Grid2X2 size={16}/></button>
        </div>
        <button title={t('Refresh')} onClick={()=>setRefresh(i=>i+1)}><RefreshCw size={16}/></button></div>
      <div className="bsp-library-local">
        <input ref={folderInput} type="file" multiple accept=".mdl" hidden onChange={async event=>{
          const files=event.target.files;if(!files?.length)return;
          setFolderBusy(true);setFolderNotice('');
          try{const result=await loadLocalBspModels(files);onImportLocal(result.models);
            setFolderNotice(`${result.models.size} ${t('models loaded this session')}${result.errors.length?` · ${result.errors.length} ${t('unsupported files')}: ${result.errors.slice(0,2).join('; ')}`:''}`);
          }catch(cause){setFolderNotice(t(String(cause instanceof Error?cause.message:cause)))}finally{setFolderBusy(false);event.target.value=''}
        }}/>
        <button disabled={folderBusy} onClick={()=>folderInput.current?.click()}><Package size={15}/>{t('Import extra MDL folder')}</button>
        <small>{localModels.size} {t('extra models loaded')} · {t('Session only: no files are copied to the game.')}</small>
        {folderNotice&&<small role="status">{folderNotice}</small>}
      </div>
      {error&&<div className="bsp-warning"><AlertTriangle size={14}/>{error}</div>}
      <div className="bsp-library-main"><div className={grid?'bsp-library-list grid':'bsp-library-list'}>{busy&&<small>{t('Loading models...')}</small>}
        {[...localList,...items].map(item=><button key={`${item.source}/${item.path}`} className={`${grid?'bsp-model-tile ':''}${selected?.source===item.source&&selected.path===item.path?'active':''}`} onClick={()=>chooseModel(item)} onDoubleClick={()=>{chooseModel(item);setPreview(item)}} title={`${item.source} / ${item.path}`}>
          {grid?<ModelThumb file={item} gameDir={gameDir} initialData={item.source==='session'?localModels.get(item.path):undefined} scrollRoot=".bsp-library-list"/>:<Package size={17}/>}
          <span><b>{item.name}</b><small>{item.path}</small></span><small>{item.source==='session'?t('Local folder'):item.source}</small>
        </button>)}
        {!busy&&!items.length&&!localList.length&&!error&&<p>{t('No models match the current search.')}</p>}
      </div><aside className="bsp-library-details">
        {selected?<><strong>{selected.name}</strong><code>{selected.path}</code><small>{t('Source')}: {selected.source==='session'?t('Local folder'):selected.source}</small>
          <button onClick={()=>setPreview(selected)}><Eye size={15}/>{t('Preview 3D model')}</button>
          <button disabled={!canAssign} onClick={()=>onAssign(selected.path)}><Package size={15}/>{t('Apply to selected point entity')}</button>
          <small>{t('Assignment only changes the model path. Use Convert to change behavior.')}</small>
          <div className="bsp-model-placement-form" aria-label={t('MDL placement behavior')}>
            <strong>{t('Placement behavior')}</strong>
            <div className="bsp-model-mode-switch" role="group" aria-label={t('Placement behavior')}>
              {([
                ['decoration',t('Decoration')],['solid',t('Solid prop')],
                ['npc',t('NPC')],['cycler',t('Hit-test model')]
              ] as [BspModelPlacementMode,string][]).map(([mode,label])=><button key={mode}
                type="button" aria-pressed={settings.mode===mode} className={settings.mode===mode?'active':''}
                onClick={()=>updateSetting('mode',mode)}>{mode==='npc'?<UserRound size={13}/>:mode==='solid'?<Shield size={13}/>:<Package size={13}/>} {label}</button>)}
            </div>
            <p className="bsp-model-mode-info">{t(settings.mode==='decoration'
              ?'Decorative item_generic: visual model, no player collision or monster AI.'
              :settings.mode==='solid'
              ?'Solid item_generic: blocks passage using the specified hull; not an NPC.'
              :settings.mode==='cycler'
              ?'Cycler: reacts to bullet hits by changing animation; no combat AI or normal monster health.'
              :'NPC class determines AI, collision, damage and available animations. The MDL alone does not create AI.')}</p>
            {settings.mode==='npc'&&<>
              {suggestedNpc&&<div className="bsp-model-recommendation"><strong>{t('Recommended native AI class')}: {suggestedNpc}</strong><button type="button" onClick={()=>updateSetting('npcClassname',suggestedNpc)}>{t('Use recommended class')}</button></div>}
              {settings.npcClassname==='monster_generic'&&<p className="bsp-model-warning">{t('monster_generic is scripted and does not automatically fight. Choose a native combat class matching this model.')}</p>}
              <label>{t('NPC engine class')}
                <select value={settings.npcClassname} onChange={e=>updateSetting('npcClassname',e.target.value)}>
                  {allowedNpcClassnames.map(name=><option key={name} value={name}>{name}{npcClasses.find(c=>c.name===name)?.description?` — ${npcClasses.find(c=>c.name===name)!.description}`:''}</option>)}
                </select>
              </label>
              <label>{t('Health (0 = engine default)')}<input type="number" min="0" max="100000" value={settings.health} onChange={e=>updateSetting('health',e.target.value)}/></label>
              <label className="bsp-model-check"><input type="checkbox" checked={settings.ally} onChange={e=>updateSetting('ally',e.target.checked)}/>{t('Player ally')}</label>
              <label>{t('Monster roaming')}
                <select value={settings.roaming} onChange={e=>updateSetting('roaming',e.target.value as '0'|'1'|'2')}>
                  <option value="0">{t('Map default')}</option><option value="1">{t('Never roam')}</option><option value="2">{t('Always roam')}</option>
                </select>
              </label>
              <label>{t('Spawnflags (decimal)')}<input value={settings.spawnflags} inputMode="numeric" onChange={e=>updateSetting('spawnflags',e.target.value)}/></label>
              {/^(monster_human_grunt|monster_human_grunt_ally|monster_male_assassin|monster_bodyguard)$/.test(settings.npcClassname)&&
                <label>{t('Weapon loadout (class specific)')}<input type="number" min="0" max="65535" value={settings.weapons} onChange={e=>updateSetting('weapons',e.target.value)}/></label>}
              {settings.npcClassname==='monster_generic'&&<label className="bsp-model-check"><input type="checkbox" checked={settings.disableAI} onChange={e=>updateSetting('disableAI',e.target.checked)}/>{t('Disable monster AI')}</label>}
              <label className="bsp-model-check"><input type="checkbox" checked={settings.customNpcHull} onChange={e=>updateSetting('customNpcHull',e.target.checked)}/>{t('Custom NPC collision hull')}</label>
              <label>{t('In-game display name')}<input value={settings.displayname} maxLength={80} onChange={e=>updateSetting('displayname',e.target.value)}/></label>
              <p>{t('monster_generic is primarily scripted; native NPC classes need compatible animation sequences. G-Man is normally noncombat/invulnerable.')}</p>
            </>}
            {(settings.mode==='solid'||settings.mode==='npc'&&settings.customNpcHull)&&<>
              <label>{t('Hull minimum (X Y Z)')}<input value={settings.minHull} onChange={e=>updateSetting('minHull',e.target.value)} spellCheck={false}/></label>
              <label>{t('Hull maximum (X Y Z)')}<input value={settings.maxHull} onChange={e=>updateSetting('maxHull',e.target.value)} spellCheck={false}/></label>
              <p>{t('Solid collisions are computed in Sven Co-op from the hull, not automatically from the MDL mesh.')}</p>
            </>}
            {(settings.mode==='solid'||settings.mode==='decoration')&&<>
              <label>{t('Model scale')}<input type="number" step="0.1" min="0.1" max="8" value={settings.scale} onChange={e=>updateSetting('scale',e.target.value)}/></label>
              <label>{t('Idle sequence name (optional)')}<input value={settings.sequenceName} maxLength={64} onChange={e=>updateSetting('sequenceName',e.target.value)} placeholder="idle"/></label>
            </>}
            {(settings.mode==='solid'||settings.mode==='decoration'||settings.mode==='npc'&&settings.npcClassname==='monster_generic')&&
              <label>{t('Sequence index (optional)')}<input type="number" min="0" max="4096" value={settings.sequenceNumber} onChange={e=>updateSetting('sequenceNumber',e.target.value)} placeholder="0"/></label>}
            <div className="bsp-model-two-fields">
              <label>{t('Skin')}<input type="number" min="0" max="255" value={settings.skin} onChange={e=>updateSetting('skin',e.target.value)}/></label>
              <label>{t('Bodygroup')}<input type="number" min="0" max="65535" value={settings.body} onChange={e=>updateSetting('body',e.target.value)}/></label>
            </div>
            <label>{t('Targetname (optional)')}<input value={settings.targetname} maxLength={64} onChange={e=>updateSetting('targetname',e.target.value)}/></label>
            {modelSpec.error&&<p className="bsp-model-form-error" role="alert"><AlertTriangle size={14}/>{t(modelSpec.error)}</p>}
            <button className="primary" disabled={!modelSpec.spec} onClick={()=>{if(modelSpec.spec)onPlace(modelSpec.spec)}}>
              <MousePointer2 size={15}/>{t('Place configured model in 3D')}</button>
            <button disabled={!canConvert||!modelSpec.spec} onClick={()=>{
              if(!modelSpec.spec||!canConvert)return;
              if(!window.confirm(t('Convert the selected point model entity to this behavior? The change can be undone.')))return;
              onConvert(modelSpec.spec);
            }}><Shield size={15}/>{t('Convert selected model entity')}</button>
            <small>{t('Converting preserves the selected entity position and connections, but resets mode-specific keys. Inspect before export.')}</small>
          </div></>
        :<p>{t('Select a model to preview, assign or place it.')}</p>}
      </aside></div>
      <footer>{t('Original MDL files are read-only. A BSP stores model paths, not MDL file data.')}</footer>
    </section>
    {preview&&<ModelPreviewModal gameDir={gameDir} file={preview} initialData={preview.source==='session'?localModels.get(preview.path):undefined} assignDisabled={!canAssign} onClose={()=>setPreview(null)} onAssign={()=>{if(!canAssign)return;onAssign(preview.path);setPreview(null)}}/>}
  </div>;
}
