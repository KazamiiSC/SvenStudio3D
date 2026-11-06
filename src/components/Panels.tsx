import {ExplorerOrganized} from './ExplorerOrganized';
import { useEffect,useMemo,useRef,useState,type ChangeEvent } from 'react';
import {createPortal} from 'react-dom';
import type React from 'react';
import { Box,Layers,Image,Search,Plus,Star,Eye,EyeOff,Lock,Unlock,ChevronRight,ChevronDown,FileCode2,FolderOpen,Upload,Trash2,Copy,Unlink,Paintbrush,Sun,UserRound,Info,Settings2,Grid3x3,Brush,Check,DoorOpen,CornerDownRight,Globe2, Skull, Route, Headphones } from 'lucide-react';
import { useEditor } from '../store';
import {confirmBrushDetach} from './brushEntityActions';
import { parseWad } from '../engine/wad';
import { parseFgd } from '../engine/fgd';
import type { MapObject,Brush as BrushObject,PointEntity,FgdClass,Face,TextureAsset } from '../engine/types';
import { brushDimensions } from '../engine/geometry';
import {useT} from '../i18n';
import {ModelBrowser} from './ModelBrowser';
import {Boxes} from 'lucide-react';
import {npcClasses} from '../engine/npc';
import {SoundBrowser} from './SoundStudio';
import {EntityAssistant} from './EntityAssistant';
import {spawnYaw,withSpawnYaw} from '../engine/spawnPresentation';
import {entityConnectionLabel,connectionSearchText} from '../engine/entityNaming';

function stopProp(e:React.MouseEvent){e.stopPropagation()}
export function AssetPanel(){
  const tr=useT();
  const savedResource=useEditor(s=>s.resourceView),resource=savedResource==='objects'?'entities':savedResource,setResource=useEditor(s=>s.setResourceView);
  const [query,setQuery]=useState('');
  const [entityInfo,setEntityInfo]=useState<FgdClass|null>(null);
  useEffect(()=>{setQuery('');setTexturePage(1);},[resource]);
  const wadsRef=useRef<HTMLInputElement>(null),fgdRef=useRef<HTMLInputElement>(null);
  const setTextures=useEditor(s=>s.setTextures),setFgd=useEditor(s=>s.setFgd);
  const textures=useEditor(s=>s.textureAssets),classes=useEditor(s=>s.fgdClasses);
  const fgdLoaded=useEditor(s=>s.fgdLoaded);
  const placementShape=useEditor(s=>s.placementShape);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const selectTexture=useEditor(s=>s.paintSelected);
  const currentTexture=useEditor(s=>s.currentTexture);
  const addEntity=useEditor(s=>s.addEntity);
  const startNpc=useEditor(s=>s.startNpcPlacement);
  const npcPending=useEditor(s=>s.pendingNpcClass);
  const [filter,setFilter]=useState('all');
  const [entityCategory,setEntityCategory]=useState('all');
  const [favorites,setFavorites]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('svenstudio-texture-favorites')||'[]')}catch{return []}});
  const [onlyFavorites,setOnlyFavorites]=useState(false);
  const [texturePage,setTexturePage]=useState(1);
  const [recent,setRecent]=useState<string[]>([]);
  // A lightweight right-click menu for WAD tiles and FGD classes. Keeps
  // common actions discoverable without adding hundreds of extra buttons.
  const [assetMenu,setAssetMenu]=useState<{x:number;y:number;kind:'texture';value:TextureAsset}|{x:number;y:number;kind:'entity';value:FgdClass}|null>(null);
  useEffect(()=>{
    if(!entityInfo)return;
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setEntityInfo(null)};
    window.addEventListener('keydown',close);
    return()=>window.removeEventListener('keydown',close);
  },[entityInfo]);
  useEffect(()=>{
    if(!assetMenu)return;
    const dismiss=(e:PointerEvent)=>{if(!(e.target as HTMLElement)?.closest('.asset-context-menu'))setAssetMenu(null)};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setAssetMenu(null)};
    document.addEventListener('pointerdown',dismiss,true);window.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss,true);window.removeEventListener('keydown',escape)};
  },[assetMenu]);

  const favoriteKey=(t:{name:string;wad:string})=>`${t.wad}:${t.name}`;
  const toggleFavorite=(t:{name:string;wad:string})=>setFavorites(previous=>{
    const key=favoriteKey(t);
    const next=previous.includes(key)?previous.filter(x=>x!==key):[...previous,key];
    try{localStorage.setItem('svenstudio-texture-favorites',JSON.stringify(next))}catch{/* Favorite remains available in this session. */}
    return next;
  });
  const applyTexture=(t:{name:string;wad:string})=>{selectTexture(t.name);setRecent(a=>[favoriteKey(t),...a.filter(x=>x!==favoriteKey(t))].slice(0,15))};
  const appendLogs=useEditor(s=>s.appendLogs);
  const filteredTextures=useMemo(()=>textures.filter(t=>(filter==='all'||filter===t.wad)&&(!onlyFavorites||favorites.includes(favoriteKey(t)))&&t.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b)=>{
      const ia=recent.indexOf(favoriteKey(a)),ib=recent.indexOf(favoriteKey(b));
      if(ia>=0||ib>=0)return ia<0?1:ib<0?-1:ia-ib;
      return a.name.localeCompare(b.name);
    }),[textures,filter,query,onlyFavorites,favorites,recent]);
  const shownTextures=filteredTextures.slice(0,texturePage*80);
  const entityCategoryOf=(cls:FgdClass):string=>{
    if(cls.name.startsWith('monster_'))return 'NPCs';
    if(cls.name.startsWith('trigger_'))return 'Triggers';
    if(cls.name.startsWith('weapon_'))return 'Weapons';
    if(cls.name.startsWith('ammo_')||cls.name.startsWith('item_'))return 'Items';
    if(cls.name.startsWith('light'))return 'Lighting';
    if(cls.type==='solid')return 'Brush entities';
    if(/^(env_|game_|multi_|logic_|ambient_)/.test(cls.name))return 'Logic & effects';
    return 'Other';
  };
  const npcList=useMemo(()=>npcClasses(classes).filter(c=>(c.name+' '+c.description).toLowerCase().includes(query.toLowerCase())).slice(0,500),[classes,query]);
  const filteredClasses=useMemo(()=>classes.filter(c=>(entityCategory==='all'||entityCategoryOf(c)===entityCategory)&&
    (c.name.toLowerCase().includes(query.toLowerCase())||c.description.toLowerCase().includes(query.toLowerCase()))).slice(0,1000),[classes,query,entityCategory]);
  const importWads=async(e:ChangeEvent<HTMLInputElement>)=>{
    if(!e.target.files)return;
    for(const file of Array.from(e.target.files)){
      try{const result=await parseWad(file);setTextures(result,file.name);appendLogs([`Imported ${result.length} textures from ${file.name}`]);}
      catch(err){appendLogs([`WAD ERROR ${file.name}: ${String(err)}`]);alert(String(err));}
    }e.target.value='';
  };
  const loadGameFgd=async()=>{
    if(!gameDir){alert(tr('Configure the game directory in Build Settings first.'));return;}
    try{
      const response=await fetch('/api/svengine/fgd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir})});
      if(!response.ok){const message=await response.json();throw Error(message.error||`HTTP ${response.status}`)}
      const classes=parseFgd(await response.text());
      if(!classes.length)throw Error('FGD has no recognizable classes.');
      setFgd(classes);appendLogs([`Svengine: loaded ${classes.length} entities from sven-coop.fgd.`]);
    }catch(error){alert(String(error));appendLogs([`FGD: ${String(error)}`])}
  };
  const importFgd=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const classes=parseFgd(await file.text());
      if(!classes.length)throw Error('FGD has no recognizable entity classes.');
      setFgd(classes);appendLogs([`Imported ${classes.length} entity definitions from ${file.name}`]);
    }catch(error){
      const message=String(error instanceof Error?error.message:error);
      appendLogs([`FGD import failed (${file.name}): ${message}`]);
      window.alert(`${tr('Import failed')}: ${message}`);
    }finally{e.target.value='';}
  };
  return <aside className="asset-panel">
    <div className="asset-tabs">
      <button className={resource==='entities'?'active':''} onClick={()=>{setResource('entities');setQuery('')}} title={tr('Entities')}><UserRound size={16}/></button>
      <button className={resource==='textures'?'active':''} onClick={()=>{setResource('textures');setQuery('')}} title={tr('Texture Browser')}><Image size={16}/></button>
      <button className={resource==='models'?'active':''} onClick={()=>{setResource('models');setQuery('')}} title="Model Browser (.mdl)"><Boxes size={16}/></button>
      <button className={resource==='sounds'?'active':''} onClick={()=>{setResource('sounds');setQuery('')}} title={tr('Sound Browser')}><Headphones size={16}/></button>
      <button className={resource==='npcs'?'active':''} onClick={()=>{setResource('npcs');setQuery('')}} title={tr('NPC Browser')}><Skull size={16}/></button>
      <button className={resource==='layers'?'active':''} onClick={()=>{setResource('layers');setQuery('')}} title={tr('Layers')}><Layers size={16}/></button>
    </div>
    <div className="panel-header"><span>{tr(resource==='entities'?'Entity Browser':resource==='textures'?'Texture Browser':resource==='models'?'Model Browser':resource==='npcs'?'NPC Browser':resource==='sounds'?'Sound Browser':'Layers')}</span><span className="subtle">{resource==='entities'?classes.length:resource==='textures'?textures.length:''}</span></div>
    {(resource==='entities'||resource==='textures'||resource==='npcs')&&<div className="search-field"><Search size={15}/><input value={query} onChange={e=>{setQuery(e.target.value);setTexturePage(1)}} placeholder={tr(resource==='textures'?'Search textures...':resource==='npcs'?'Search NPCs…':'Search classname...')} /></div>}
    {resource==='models'&&<ModelBrowser/>}
    {resource==='sounds'&&<SoundBrowser compact/>}
    {resource==='npcs'&&<div className="assets-scroll npc-asset-list">
      <p className="npc-hint">{tr('Choose an NPC and click on a map surface to place it. Drag and drop also works.')}</p>
      {!fgdLoaded&&<p className="npc-hint">{tr('Starter list. Import sven-coop.fgd for full list.')}</p>}
      {npcList.map(cls=><button className={`entity-entry ${npcPending===cls.name?'active':''}`} key={cls.name} draggable
        onDragStart={e=>{e.dataTransfer.setData('application/x-svenstudio-entity',cls.name);e.dataTransfer.effectAllowed='copy'}}
        onClick={()=>startNpc(npcPending===cls.name?null:cls.name)} title={`${cls.description} · ${cls.studio||'No FGD model'}`}>
        <span className="entity-type point"><Skull size={14}/></span><span><strong>{cls.name}</strong><small>{cls.studio||cls.description}</small></span><Plus size={13}/></button>)}
      <div className="npc-asset-footer"><Route size={15}/>{tr('Use NPC & AI Studio for routes, spawners and validation.')}</div>
    </div>}
    {resource==='entities'&&<>
      <div className="import-area"><button className="soft-button" onClick={loadGameFgd}><FolderOpen size={14}/> {tr('Load Sven Co-op FGD')}</button><button className="soft-button" onClick={()=>fgdRef.current?.click()}><Upload size={14}/> {tr('Import .FGD')}</button><input ref={fgdRef} type="file" hidden accept=".fgd" onChange={importFgd}/><p>{tr(fgdLoaded?'Imported FGD definitions active':'Starter list. Import sven-coop.fgd for full list.')}</p></div>
      <div className="entity-category-row"><select value={entityCategory} onChange={e=>setEntityCategory(e.target.value)} title={tr('Entity category')}>
        {['all','NPCs','Triggers','Weapons','Items','Lighting','Brush entities','Logic & effects','Other'].map(v=><option value={v} key={v}>{tr(v==='all'?'All categories':v)}</option>)}
      </select><span>{filteredClasses.length}</span></div>
      <div className="assets-scroll entity-list">{filteredClasses.map(cls=><div className="entity-entry-wrap" key={cls.name}><button draggable={cls.type==='point'}
        onDragStart={e=>{e.dataTransfer.setData('application/x-svenstudio-entity',cls.name);e.dataTransfer.effectAllowed='copy'}}
        className="entity-entry" onContextMenu={e=>{e.preventDefault();setAssetMenu({x:e.clientX,y:e.clientY,kind:'entity',value:cls})}} onClick={()=>addEntity(cls)} title={`${cls.description} · ${cls.type}`}>
        <span className={`entity-type ${cls.type}`}>{cls.type==='point'?<UserRound size={13}/>:<Box size={13}/>}</span><span><strong>{cls.name}</strong><small>{cls.description}</small></span><Plus size={13}/></button>
        <button type="button" className="entity-guide-icon" aria-label={`Guía ${cls.name}`} title={`Guía: ${cls.name}`} onClick={()=>setEntityInfo(cls)}><Info size={14}/></button></div>)}</div>
    </>}
    {resource==='textures'&&<>
      <div className="import-area"><button className="soft-button" onClick={()=>wadsRef.current?.click()}><Upload size={14}/> {tr('Import WAD3')}</button><input ref={wadsRef} multiple type="file" hidden accept=".wad" onChange={importWads}/><p>{tr('Choose textures, then paint selected faces or brushes.')}</p></div>
      {textures.length>0&&<div className="filter-wrap"><button className={`favorite-filter ${onlyFavorites?'active':''}`} title={tr('Show favorites only')} onClick={()=>{setOnlyFavorites(v=>!v);setTexturePage(1)}}><Star size={13} fill={onlyFavorites?'currentColor':'none'}/></button><select value={filter} onChange={e=>{setFilter(e.target.value);setTexturePage(1)}}><option value="all">{tr('All WAD files')}</option>{Array.from(new Set(textures.map(t=>t.wad))).map(n=><option key={n} value={n}>{n}</option>)}</select></div>}
      {textures.length===0?<div className="empty-message"><Image size={30}/><strong>{tr('No WAD textures loaded')}</strong><span>{tr('Import halflife.wad or another WAD3 file from Sven Co-op.')}</span></div>:<div className="texture-results assets-scroll"><p className="texture-progress">{tr('Showing textures')}: {shownTextures.length} / {filteredTextures.length}</p><div className="texture-grid">{shownTextures.map((t,i)=><div key={t.wad+':'+t.name+':'+i} className={`texture-tile ${currentTexture===t.name?'chosen':''}`} onContextMenu={e=>{e.preventDefault();setAssetMenu({x:e.clientX,y:e.clientY,kind:'texture',value:t})}}>
        <button className="texture-apply" draggable onDragStart={e=>{e.dataTransfer.setData('application/x-svenstudio-texture',t.name);e.dataTransfer.effectAllowed='copy'}} onClick={()=>applyTexture(t)} title={`${t.name} · ${t.width}x${t.height} · ${t.wad}. Drag over a 3D face to paint it.`}><img src={t.thumbUrl||t.dataUrl} alt={t.name} loading="lazy"/><span>{t.name}</span></button>
        <button className={`texture-favorite ${favorites.includes(favoriteKey(t))?'active':''}`} onClick={()=>toggleFavorite(t)} title={tr('Toggle favorite')}><Star size={12} fill={favorites.includes(favoriteKey(t))?'currentColor':'none'}/></button>
      </div>)}</div>{shownTextures.length<filteredTextures.length&&<button className="texture-load-more" onClick={()=>setTexturePage(v=>v+1)}>{tr('Load more textures')} (+{Math.min(80,filteredTextures.length-shownTextures.length)})</button>}</div>}
    </>}
    {resource==='layers'&&<LayerPanel/>}
    {assetMenu&&createPortal(<div className="studio-context-menu asset-context-menu" role="menu" onContextMenu={e=>e.preventDefault()} style={{left:Math.max(6,Math.min(window.innerWidth-280,assetMenu.x)),top:Math.max(6,Math.min(window.innerHeight-250,assetMenu.y))}}>
      <div className="context-head"><span>{assetMenu.value.name}</span><small>{assetMenu.kind==='texture'?`${assetMenu.value.wad} · ${assetMenu.value.width}×${assetMenu.value.height}`:assetMenu.value.type}</small></div>
      {assetMenu.kind==='texture'?<>
        <button type="button" onClick={()=>{applyTexture(assetMenu.value);setAssetMenu(null)}}><Paintbrush size={15}/><span>{tr('Apply texture')}</span></button>
        <button type="button" onClick={()=>{toggleFavorite(assetMenu.value);setAssetMenu(null)}}><Star size={15}/><span>{tr(favorites.includes(favoriteKey(assetMenu.value))?'Remove from favorites':'Add to favorites')}</span></button>
        <button type="button" onClick={()=>{void navigator.clipboard?.writeText(assetMenu.value.name);setAssetMenu(null)}}><Copy size={15}/><span>{tr('Copy texture name')}</span></button>
        <button type="button" onClick={()=>{void navigator.clipboard?.writeText(assetMenu.value.wad);setAssetMenu(null)}}><Copy size={15}/><span>{tr('Copy WAD name')}</span></button>
      </>:<>
        <button type="button" onClick={()=>{addEntity(assetMenu.value);setAssetMenu(null)}}><Plus size={15}/><span>{tr('Add entity to map')}</span></button>
        <button type="button" onClick={()=>{useEditor.getState().selectSameClass(assetMenu.value.name);setAssetMenu(null)}}><UserRound size={15}/><span>{tr('Select same classname')}</span></button>
        <button type="button" onClick={()=>{void navigator.clipboard?.writeText(assetMenu.value.name);setAssetMenu(null)}}><Copy size={15}/><span>{tr('Copy classname')}</span></button>
        <button type="button" onClick={()=>{setEntityInfo(assetMenu.value);setAssetMenu(null)}}><Info size={15}/><span>{tr('Entity guide')}</span></button>
      </>}
    </div>,document.body)}
    {entityInfo&&createPortal(<div className="entity-guide-modal" onMouseDown={e=>{if(e.target===e.currentTarget)setEntityInfo(null)}} role="presentation"><div className="entity-guide-dialog" role="dialog" aria-modal="true" aria-label={entityInfo.name}><header><strong>{entityInfo.name}</strong><button onClick={()=>setEntityInfo(null)} aria-label={tr('Close')}>×</button></header><EntityAssistant key={entityInfo.name} entity={null} definition={entityInfo} initiallyOpen/></div></div>,document.body)}
  </aside>;
}
function LayerPanel(){
  const t=useT();
  const objects=useEditor(s=>s.project.objects);
  const toggleLayerVisibility=useEditor(s=>s.toggleLayerVisibility);
  const selected=useEditor(s=>s.selectedIds),groupSelected=useEditor(s=>s.groupSelected),ungroup=useEditor(s=>s.ungroupSelected);
  const selectGroup=useEditor(s=>s.selectGroup),toggleGroupVisibility=useEditor(s=>s.toggleGroupVisibility),toggleGroupLocked=useEditor(s=>s.toggleGroupLocked);
  const [groupName,setGroupName]=useState('New Group'),[error,setError]=useState('');
  const run=(fn:()=>void)=>{try{fn();setError('')}catch(err){setError(String(err))}};
  const layers=Array.from(new Set(['Geometry','Gameplay','Lighting',...objects.map(o=>o.layer||'Geometry')]));
  const groups=Array.from(new Set(objects.map(o=>o.group).filter((g):g is string=>!!g)));
  return <div className="assets-scroll"><div className="hint-block">{t('Assign an object to a layer from its Properties panel.')}</div>{layers.map(layer=>{
    const inLayer=objects.filter(o=>(o.layer||'Geometry')===layer);
    return <div className="layer-line" key={layer}><Layers size={15}/><span>{layer}</span><span>{inLayer.length}</span><button className="tree-action" onClick={()=>toggleLayerVisibility(layer)} title={t('Show/hide layer')} style={{opacity:1}}>{inLayer.length&&inLayer.every(o=>o.hidden)?<EyeOff size={14}/>:<Eye size={14}/>}</button></div>;
  })}
    <div className="category-label">{t('Groups')} · v0.7</div>
    <div className="operation-line"><input className="asset-small-input" value={groupName} maxLength={64} onChange={e=>setGroupName(e.target.value)} aria-label={t('Group name')}/><button disabled={!selected.length} onClick={()=>run(()=>groupSelected(groupName))}>{t('Group')}</button><button disabled={!selected.length} onClick={()=>run(ungroup)}>{t('Ungroup')}</button></div>
    {groups.map(group=>{const members=objects.filter(o=>o.group===group);return <div className="layer-line" key={group}><Layers size={14}/><button className="asset-text-button" onClick={()=>selectGroup(group)} title={t('Select entire group')}>{group}</button><span>{members.length}</span><button className="tree-action" title={t('Show/hide group')} onClick={()=>toggleGroupVisibility(group)}>{members.every(o=>o.hidden)?<EyeOff size={14}/>:<Eye size={14}/>}</button><button className="tree-action" title={t('Lock/unlock group')} onClick={()=>toggleGroupLocked(group)}>{members.every(o=>o.locked)?<Lock size={14}/>:<Unlock size={14}/>}</button></div>})}
    {error&&<p className="modeling-error" role="alert">{error}</p>}
  </div>;
}
function PrefabLibrary(){
  const t=useT();
  const items=useEditor(s=>s.prefabs),remove=useEditor(s=>s.removePrefab),place=useEditor(s=>s.instantiatePrefab),add=useEditor(s=>s.addPrefab);
  const selected=useEditor(s=>s.selected),objects=useEditor(s=>s.project.objects);
  const [message,setMessage]=useState(''),[offset,setOffset]=useState<[number,number,number]>([0,0,64]);
  const importRef=useRef<HTMLInputElement>(null);
  const invoke=(fn:()=>void)=>{try{fn();setMessage('')}catch(err){setMessage(String(err))}};
  const onFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(file.size>2_000_000){setMessage(t('Prefab file too large (max 2 MB).'));return}
    try{add(JSON.parse(await file.text()));setMessage(t('Prefab imported.'))}catch(error){setMessage(String(error))}
  };
  const save=(item:(typeof items)[number])=>{
    const blob=new Blob([JSON.stringify(item,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const element=document.createElement('a');
    element.href=url;element.download=`${item.name.replace(/[^a-z0-9_-]/gi,'_')}.svprefab.json`;element.click();URL.revokeObjectURL(url);
  };
  const current=objects.find(o=>o.id===selected);
  return <div className="prefab-library">
    <div className="category-label">{t('Prefabs')} · v0.7</div>
    <div className="modeling-note">{t('Save a selection from Properties, then reuse it in any project. Library is stored in this browser; Export for backup.')}</div>
    <div className="operation-line"><button onClick={()=>importRef.current?.click()}><Upload size={13}/> {t('Import prefab')}</button><input ref={importRef} type="file" accept=".json,.svprefab.json" hidden onChange={onFile}/></div>
    <div className="operation-grid">{offset.map((n,i)=><label key={i}>{['X','Y','Z'][i]}<input type="number" step="16" value={n} onChange={e=>{const next=[...offset] as [number,number,number];next[i]=Number(e.target.value);setOffset(next)}}/></label>)}</div>
    {current&&<button className="panel-link" onClick={()=>setOffset([...current.position])}>{t('Use selected object position')}</button>}
    {!items.length&&<p className="panel-text">{t('No prefabs saved yet.')}</p>}
    {items.map(item=><div className="prefab-row" key={item.id}><span title={item.name}>{item.name}<small>{item.objects.length} {t('objects')}</small></span><button onClick={()=>invoke(()=>place(item.id,offset))} title={t('Place at coordinates')}><Plus size={14}/></button><button onClick={()=>save(item)} title={t('Export JSON')}><FolderOpen size={14}/></button><button onClick={()=>invoke(()=>remove(item.id))} title={t('Delete prefab')}><Trash2 size={14}/></button></div>)}
    {message&&<p className="modeling-error" role="alert">{message}</p>}
  </div>;
}
export function Explorer(){return <ExplorerOrganized/>;}
function Field({label,value,onChange,type='text',step=1}:{label:string,value:string|number,onChange:(v:string)=>void,type?:string,step?:number}){
  const [draft,setDraft]=useState(String(value));
  const [focused,setFocused]=useState(false);
  return <label className="property-field"><span title={label}>{label}</span><input type={type} step={step} value={focused?draft:String(value)} onFocus={()=>{setDraft(String(value));setFocused(true)}} onChange={e=>setDraft(e.target.value)} onBlur={()=>{setFocused(false);if(draft!==String(value))onChange(draft)}} onKeyDown={e=>{if(e.key==='Enter')(e.currentTarget as HTMLInputElement).blur()}}/></label>;
}
function VectorFields({label,value,onChange}:{label:string,value:[number,number,number],onChange:(a:[number,number,number])=>void}){
  return <div className="vector-property"><span>{label}</span><div>{value.map((v,i)=><label key={i} className={`vector-item v${i}`}><small>{['X','Y','Z'][i]}</small><input type="number" key={`${i}-${v}`} defaultValue={Number(v.toFixed(2))} step={1} onBlur={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n!==v){const copy=[...value] as [number,number,number];copy[i]=n;onChange(copy)}}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/></label>)}</div></div>;
}
export function Properties(){
  const t=useT();
  const selected=useEditor(s=>s.selected);const selectedFace=useEditor(s=>s.selectedFace);const faceMode=useEditor(s=>s.faceMode);
  const object=useEditor(s=>s.project.objects.find(o=>o.id===s.selected));
  const change=useEditor(s=>s.updateObject),setDimensions=useEditor(s=>s.changeDimensions),setProp=useEditor(s=>s.setObjectProp),setLayer=useEditor(s=>s.setLayer);
  const selectedIds=useEditor(s=>s.selectedIds);
  const cls=useEditor(s=>s.fgdClasses.find(c=>c.name===(object?.kind==='entity'?object.classname:'')));
  const [newKey,setNewKey]=useState(''),[newValue,setNewValue]=useState(''),[targetSearch,setTargetSearch]=useState('');
  const remove=useEditor(s=>s.removeSelected),duplicate=useEditor(s=>s.duplicateSelected);
  const objects=useEditor(s=>s.project.objects);
  const unlink=useEditor(s=>s.detachBrushEntities);
  const tryDetach=(ids:string[],whole=false)=>{
    if(confirmBrushDetach(objects,ids,whole,t))unlink(ids,whole);
  };
  const linkedEntity=object?.kind==='brush'&&object.entityId?objects.find(o=>o.kind==='entity'&&o.id===object.entityId):null;
  const linkedBrushCount=object?.kind==='brush'&&object.entityId?objects.filter(o=>o.kind==='brush'&&o.entityId===object.entityId).length:0;
  const attachedBrushCount=object?.kind==='entity'?objects.filter(o=>o.kind==='brush'&&o.entityId===object.id).length:0;
  const detachCandidates=objects.filter(o=>selectedIds.includes(o.id)&&(o.kind==='brush'&&!!o.entityId||o.kind==='entity'&&objects.some(b=>b.kind==='brush'&&b.entityId===o.id)));
  const world=useEditor(s=>s.project.world),changeWorld=useEditor(s=>s.changeWorld);
  if(!object)return <div className="properties"><div className="panel-header"><span><Settings2 size={15}/> {t('World Properties')}</span></div><div className="property-scroll">
    <div className="property-object-header"><span className="property-avatar"><Globe2 size={19}/></span><span><strong>worldspawn</strong><small>{t('Map environment')}</small></span></div>
    <div className="property-group-title">{t('WORLD SETTINGS')}</div>
    {['message','skyname','MaxRange','light'].map(k=><Field key={k} label={k} value={world[k]||''} onChange={v=>changeWorld(k,v)}/>)}
    <div className="hint-block">{t('Select a brush or entity in the viewport to edit its properties.')}</div>
  </div></div>;
  if(selectedIds.length>1)return <div className="properties"><div className="panel-header"><span><Settings2 size={15}/> {t('Multi-selection')}</span><span className="counter">{selectedIds.length}</span></div><div className="property-scroll">
    <div className="property-object-header"><span className="property-avatar"><Layers size={19}/></span><span><strong>{selectedIds.length} {t('objects selected')}</strong><small>{t('Move group with the 3D gizmo')}</small></span></div>
    <p className="panel-text">{t('Use Ctrl/Shift + click in Explorer or the viewport to change the selection. Group move is committed when releasing the gizmo; Rotate and Scale remain individual operations.')}</p>
    {detachCandidates.length>0&&<section className="modeling-properties">
      <div className="property-group-title">{t('Brush entity association')}</div>
      <p className="modeling-note">{t('Detach selected brush(es) or entire linked entities while preserving the brush geometry and UVs.')}</p>
      <div className="operation-buttons">
        <button onClick={()=>tryDetach(selectedIds,false)}><Unlink size={14}/> {t('Detach selected brushes')}</button>
        <button onClick={()=>tryDetach(selectedIds,true)}><Unlink size={14}/> {t('Detach all brushes of these entities')}</button>
      </div>
    </section>}
    <AdvancedSelectionPanel/>
    <div className="property-buttons"><button onClick={duplicate}><Copy size={13}/> {t('Duplicate all')}</button><button className="danger" onClick={remove}><Trash2 size={13}/> {t('Delete all')}</button></div>
  </div></div>;
  const brush=object.kind==='brush'?object:null;
  const point=object.kind==='entity'?object:null;
  const updateSpawnYaw=(yaw:number)=>{
    if(!point||!Number.isFinite(yaw))return;
    change(point.id,{props:{...point.props,angles:withSpawnYaw(point.props,yaw),
      ...(point.props.angle!==undefined?{angle:String(Math.round(yaw))}:{})}});
  };
  return <div className="properties"><div className="panel-header"><span><Settings2 size={15}/> {t('Properties')}</span><span className="counter">{t(brush?'Brush':'Entity')}</span></div>
    <div className="property-scroll">
      <div className="property-object-header"><span className="property-avatar">{brush?<Box size={19}/>:<UserRound size={19}/>}</span><span><strong>{object.name}</strong><small>{point?.classname||brush?.primitive||''}</small></span></div>
      <div className="property-group-title">{t('TRANSFORM')}</div>
      <Field label={t('Name')} value={object.name} onChange={name=>change(object.id,{name,editorAlias:name})}/>
      <VectorFields label={t('Position')} value={object.position} onChange={position=>change(object.id,{position})}/>
      {brush&&<><VectorFields label={t('Rotation')} value={brush.rotation} onChange={rotation=>change(brush.id,{rotation})}/><VectorFields label={t('Scale')} value={brush.scale} onChange={scale=>change(brush.id,{scale})}/><VectorFields label={t('Dimensions (units)')} value={brushDimensions(brush)} onChange={size=>{try{setDimensions(brush.id,size)}catch(error){alert(String(error))}}}/></>}
      <div className="property-group-title">{t('ORGANIZATION')}</div>
      <Field label={t('Layer')} value={object.layer||'Geometry'} onChange={layer=>setLayer(object.id,layer)}/>
      {point&&<><div className="property-group-title">{t('ENTITY KEYVALUES')}</div><Field label="classname" value={point.classname} onChange={classname=>change(object.id,{classname})}/>
        {point.classname==='info_player_start'&&<section className="spawn-facing-editor">
          <strong>{t('Start facing direction')}</strong>
          <p>{t('Set where the player looks when spawning. The direction arrow in the viewport updates immediately.')}</p>
          <label>{t('Yaw (degrees)')}<input type="number" step="15" value={spawnYaw(point.props)} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))updateSpawnYaw(n)}}/></label>
          <div className="spawn-facing-presets">{[0,90,180,270].map(yaw=><button key={yaw} type="button" className={spawnYaw(point.props)===yaw?'active':''} onClick={()=>updateSpawnYaw(yaw)}>{yaw}°</button>)}</div>
          <small>{t('The start marker rests on the floor. The original spawn origin and exported coordinates remain unchanged.')}</small>
        </section>}

        <div className="entity-property-intro">{cls?.description||point.classname}</div>        <EntityAssistant key={point.id} entity={point} definition={cls}/>
        <div className="entity-quick-links">
          <Field label="targetname" value={point.props.targetname||''} onChange={v=>setProp(object.id,'targetname',v)}/>
          <Field label="target" value={point.props.target||''} onChange={v=>setProp(object.id,'target',v)}/>
          <label className="entity-link-picker">{t('Connect to entity')}
            <input aria-label="Search connection destination" placeholder={t('Find entity by name…')} value={targetSearch} onChange={e=>setTargetSearch(e.target.value)} onKeyDown={e=>e.stopPropagation()}/>
            <select value={objects.find(x=>x.kind==='entity'&&x.id!==point.id&&x.props.targetname&&x.props.targetname===point.props.target)?.id||''} onChange={e=>{const chosen=objects.find(o=>o.kind==='entity'&&o.id===e.target.value);if(!chosen){setProp(object.id,'target','');return;}try{useEditor.getState().connectGameplay(point.id,chosen.id,true)}catch(error){window.alert(String(error))}}}>
              <option value="">{t('No connection')}</option>
              {objects.filter((x):x is PointEntity=>x.kind==='entity'&&x.id!==point.id).filter(x=>x.props.targetname&&x.props.targetname===point.props.target||!targetSearch.trim()||connectionSearchText(x,objects).includes(targetSearch.trim().toLocaleLowerCase())).slice(0,80).map(x=><option key={x.id} value={x.id}>{entityConnectionLabel(x,objects)}</option>)}
            </select>
          </label>
        </div>
        {Object.entries({...cls?.props,...Object.fromEntries(Object.keys(point.props).map(k=>[k,cls?.props[k]||{type:'string',label:k}]))}).filter(([k])=>!['target','targetname'].includes(k)).map(([key,field])=>{
          if(point.classname==='info_player_start'&&key==='angles')return null;
          const value=point.props[key]??field.defaultValue??'';
          if(field.type==='choices'&&field.options?.length)return <label key={key} className="entity-choice">{field.label}<select value={value} onChange={e=>setProp(object.id,key,e.target.value)}>
            {field.options.map(o=><option value={o.value} key={o.value}>{o.label} ({o.value})</option>)}
          </select></label>;
          if(field.type==='flags'&&field.options?.length)return <div key={key} className="entity-flags"><strong>{field.label}</strong>{field.options.map(option=><label key={option.value}>
            <input type="checkbox" checked={((Number(value)||0)&Number(option.value))!==0}
              onChange={e=>{const bit=Number(option.value)||0;const current=Number(value)||0;setProp(object.id,key,String(e.target.checked?(current|bit):(current&~bit)))}}/>{option.label}
          </label>)}</div>;
          return <Field key={key} label={field.label||key} value={value} onChange={v=>setProp(object.id,key,v)}/>;
        })}
        <div className="add-property"><input value={newKey} placeholder="key" onChange={e=>setNewKey(e.target.value)}/><input value={newValue} placeholder="value" onChange={e=>setNewValue(e.target.value)}/><button title="Add keyvalue" onClick={()=>{if(newKey.trim()){setProp(object.id,newKey.trim(),newValue);setNewKey('');setNewValue('')}}}><Plus size={14}/></button></div>
      </>}
      {brush?.entityId&&<section className="modeling-properties">
        <div className="property-group-title">{t('Brush entity association')}</div>
        {linkedEntity?.kind==='entity'&&<EntityAssistant key={linkedEntity.id} entity={linkedEntity} definition={useEditor.getState().fgdClasses.find(c=>c.name===linkedEntity.classname)}/>}
        <div className="property-meta">{t('Linked entity')}: <strong>{linkedEntity?.kind==='entity'?linkedEntity.classname:t('Missing entity')}</strong> · {linkedBrushCount} {t('brushes')}</div>
        <div className="operation-buttons">
          <button disabled={!!brush.locked} onClick={()=>tryDetach([brush.id])}><Unlink size={14}/> {t('Detach this brush (worldspawn)')}</button>
          {linkedBrushCount>1&&<button disabled={!!linkedEntity?.locked} onClick={()=>tryDetach([brush.id],true)}><Unlink size={14}/> {t('Detach entire entity')}</button>}
        </div>
        <p className="modeling-note">{t('Brush shape, textures, dimensions, position and grouping remain unchanged.')}</p>
      </section>}
      {point&&attachedBrushCount>0&&<section className="modeling-properties">
        <div className="property-group-title">{t('Brush entity association')}</div>
        <p className="property-meta">{attachedBrushCount} {t('linked brushes')} · {point.classname}</p>
        <button disabled={!!point.locked} onClick={()=>tryDetach([point.id],true)}><Unlink size={14}/> {t('Convert linked brushes to worldspawn')}</button>
      </section>}
      {brush&&<><ModelingPanel brush={brush}/><div className="property-group-title">{t('BRUSH MATERIAL')}</div>
        <div className="property-meta">{t('Faces')}: {brush.faces.length} · {t('Vertices')}: {brush.vertices.length}</div>
        {faceMode&&selectedFace!==null&&brush.faces[selectedFace]?<>
          <div className="property-meta">{t('Editing Face')} #{selectedFace+1}</div>
          <FaceEditor brush={brush} face={selectedFace}/>
        </>:<div className="property-meta">{t('Enable Face Mode and click a face to edit its texture coordinates.')}</div>}
      </>}
      <div className="property-buttons"><button onClick={duplicate}><Copy size={13}/> {t('Duplicate')}</button><button className="danger" onClick={remove}><Trash2 size={13}/> {t('Delete')}</button></div>
    </div>
  </div>;
}
function FaceEditor({brush,face}:{brush:BrushObject,face:number}){
  const t=useT();
  const f=brush.faces[face];const change=useEditor(s=>s.changeFace);
  const copy=useEditor(s=>s.copyFaceSettings),paste=useEditor(s=>s.pasteFaceSettings),align=useEditor(s=>s.alignFaceTexture),clipboard=useEditor(s=>s.faceClipboard);
  const [status,setStatus]=useState('');const safe=(fn:()=>void)=>{try{fn();setStatus('')}catch(error){setStatus(String(error))}};
  return <><Field label={t('Texture')} value={f.texture} onChange={texture=>change(brush.id,face,{texture:texture.toUpperCase()})}/>
    {(['uShift','vShift','uScale','vScale','rotation'] as const).map(key=><Field key={key} label={key} type="number" step={.1} value={f[key]??(key.endsWith('Scale')?1:0)} onChange={v=>change(brush.id,face,{[key]:Number(v)||0})}/>)}
    <div className="property-group-title">{t('Advanced Texture Tools')}</div>
    <div className="operation-buttons uv-buttons">
      <button onClick={()=>safe(()=>copy(brush.id,face))}>{t('Copy face material')}</button>
      <button disabled={!clipboard} onClick={()=>safe(()=>paste(brush.id,face))}>{t('Paste face material')}</button>
      <button onClick={()=>safe(()=>align(brush.id,face))}>{t('Align UV to world')}</button>
    </div>
    <p className="modeling-note">{t('Copy/paste transfers the texture and UV coordinates. World alignment resets offsets to zero; matching scales align adjacent faces.')}</p>
    {status&&<p role="alert" className="modeling-error">{status}</p>}
  </>;
}
export function Inspector(){return <aside className="inspector"><Explorer/><Properties/></aside>}
function AdvancedSelectionPanel(){
  const t=useT();
  const selected=useEditor(s=>s.selectedIds),objects=useEditor(s=>s.project.objects);
  const runBoolean=useEditor(s=>s.booleanSelected),group=useEditor(s=>s.groupSelected),ungroup=useEditor(s=>s.ungroupSelected);
  const addPrefab=useEditor(s=>s.saveSelectedPrefab),appendLogs=useEditor(s=>s.appendLogs);
  const [name,setName]=useState('New Group'),[prefab,setPrefab]=useState('New Room'),[message,setMessage]=useState('');
  const run=(fn:()=>void)=>{try{fn();setMessage('');appendLogs(['Advanced Studio: operation completed.'])}catch(error){const msg=String(error);setMessage(msg);appendLogs([msg])}};
  const twoBrushes=selected.length===2&&selected.every(id=>objects.find(o=>o.id===id)?.kind==='brush');
  return <section className="modeling-properties advanced-studio">
    <div className="property-group-title">{t('Advanced Building Studio')} · v0.7</div>
    <div className="modeling-note">{t('CSG requires two brushes selected in order: target first, cutter second. GoldSrc uses separate convex solids.')}</div>
    <div className="operation-buttons advanced-buttons"><button disabled={!twoBrushes} onClick={()=>run(()=>runBoolean('union'))}>{t('Union')}</button><button disabled={!twoBrushes} onClick={()=>run(()=>runBoolean('subtract'))}>{t('Subtract')}</button><button disabled={!twoBrushes} onClick={()=>run(()=>runBoolean('intersect'))}>{t('Intersect')}</button></div>
    <div className="operation-line"><label>{t('Group name')}<input value={name} maxLength={64} onChange={e=>setName(e.target.value)}/></label><button onClick={()=>run(()=>group(name))}>{t('Group')}</button><button onClick={()=>run(ungroup)}>{t('Ungroup')}</button></div>
    <div className="operation-line"><label>{t('Prefab name')}<input value={prefab} maxLength={64} onChange={e=>setPrefab(e.target.value)}/></label><button onClick={()=>run(()=>addPrefab(prefab))}>{t('Save prefab')}</button></div>
    {message&&<p className="modeling-error" role="alert">{message}</p>}
  </section>;
}

function ModelingPanel({brush}:{brush:BrushObject}){
  const t=useT();
  const mode=useEditor(s=>s.geometryMode),indices=useEditor(s=>s.editIndices);
  const edit=useEditor(s=>s.editVertices),clip=useEditor(s=>s.clipSelected),hollow=useEditor(s=>s.hollowSelected),push=useEditor(s=>s.pushPullFace);
  const bevel=useEditor(s=>s.bevelSelected),inset=useEditor(s=>s.insetSelected),extrudeFace=useEditor(s=>s.extrudeSelected);
  const savePrefab=useEditor(s=>s.saveSelectedPrefab);
  const faceMode=useEditor(s=>s.faceMode),selectedFace=useEditor(s=>s.selectedFace);
  const log=useEditor(s=>s.appendLogs);
  const [axis,setAxis]=useState<0|1|2>(0),[cut,setCut]=useState(brush.position[0]);
  const [thickness,setThickness]=useState(16),[extrude,setExtrude]=useState(16),[bevelWidth,setBevelWidth]=useState(8),[prefabName,setPrefabName]=useState('New Brush');
  const [message,setMessage]=useState('');
  const run=(fn:()=>void)=>{try{fn();setMessage('');log(['Svengine: geometry operation completed.'])}catch(error){const msg=String(error);setMessage(msg);log([`Svengine geometry: ${msg}`])}};
  const editPos=indices.length===1&&brush.vertices[indices[0]];
  return <section className="modeling-properties">
    <div className="property-group-title">{t('Geometry editing')} · Svengine</div>
    <div className="modeling-note">{t('Only closed convex brushes can be exported to Svengine. Invalid edits are rejected.')}</div>
    {(mode==='vertex'||mode==='edge')&&<>
      <p className="property-meta">{t(mode==='vertex'?'Selected vertex':'Selected edge')}: {indices.length?indices.map(n=>n+1).join(', '):'—'} · {t('Move')} (G)</p>
      {editPos&&<VectorFields label={t('Position')+' (local)'} value={editPos} onChange={pos=>run(()=>edit(brush.id,indices,pos.map((v,i)=>v-editPos[i]) as [number,number,number]))}/>}
    </>}
    {faceMode&&selectedFace!==null&&<><div className="operation-line"><label>{t('Extrusion distance (E)')}<input type="number" step="1" min="0.01" value={extrude} onChange={e=>setExtrude(Number(e.target.value))}/></label><button onClick={()=>run(()=>extrudeFace(extrude))}>{t('Extrude')}</button><button title={t('Move the face of the existing convex solid')} onClick={()=>run(()=>push(brush.id,selectedFace,extrude))}>{t('Push/Pull')}</button></div><div className="modeling-note">{t('Extrude creates a new adjacent convex brush. Push/Pull modifies the original brush.')}</div></>}
    {(mode==='edge'&&indices.length===2||faceMode&&selectedFace!==null)&&<div className="operation-line"><label>{t('Width (units)')}<input type="number" min="0.01" step="1" value={bevelWidth} onChange={e=>setBevelWidth(Number(e.target.value))}/></label>{mode==='edge'&&indices.length===2&&<button onClick={()=>run(()=>bevel(bevelWidth))}>{t('Bevel edge')}</button>}{faceMode&&selectedFace!==null&&<button onClick={()=>run(()=>inset(bevelWidth))}>{t('Inset (taper)')}</button>}</div>}
    {faceMode&&selectedFace!==null&&<div className="modeling-note">{t('UV mouse: Alt+drag moves · Alt+Shift rotates · Alt+Ctrl scales. Undo is supported.')}</div>}
    <div className="operation-grid">
      <label>{t('Cut axis')}<select value={axis} onChange={e=>{const a=Number(e.target.value) as 0|1|2;setAxis(a);setCut(brush.position[a])}}>{['X','Y','Z'].map((name,i)=><option value={i} key={name}>{name}</option>)}</select></label>
      <label>{t('Cut position')}<input type="number" step="1" value={cut} onChange={e=>setCut(Number(e.target.value))}/></label>
    </div>
    <div className="operation-buttons"><button onClick={()=>run(()=>clip(axis,cut,'both'))}>{t('Split along plane')}</button><button onClick={()=>run(()=>clip(axis,cut,'positive'))}>{t('Clip positive')}</button><button onClick={()=>run(()=>clip(axis,cut,'negative'))}>{t('Clip negative')}</button></div>
    {brush.primitive==='box'&&<div className="operation-line"><label>{t('Hollow thickness')}<input type="number" min="1" step="1" value={thickness} onChange={e=>setThickness(Number(e.target.value))}/></label><button onClick={()=>run(()=>hollow(thickness))}>{t('Hollow')}</button></div>}
    <div className="operation-line"><label>{t('Prefab name')}<input maxLength={64} value={prefabName} onChange={e=>setPrefabName(e.target.value)}/></label><button onClick={()=>run(()=>savePrefab(prefabName))}>{t('Save prefab')}</button></div>
    {message&&<p className="modeling-error" role="alert">{message}</p>}
  </section>;
}
