import {useMemo,useState,type MouseEvent,type ReactNode,type CSSProperties} from 'react';
import {Box,ChevronDown,ChevronRight,Eye,EyeOff,FolderTree,Focus,Layers,Link2,Lock,Route,Search,Unlock,UserRound,Users,AlertTriangle,MapPin,AudioLines,DoorOpen,Sun,Package,Skull,Target,FilterX} from 'lucide-react';
import {useEditor} from '../store';
import {organizeScene,routeColor,type SceneGroup} from '../engine/sceneOrganization';
import type {MapObject} from '../engine/types';
import {useT} from '../i18n';

const icons:Record<string,typeof Box>={geometry:Box,npc:Skull,spawners:Users,audio:AudioLines,lighting:Sun,triggers:Target,brushentities:DoorOpen,items:Package,other:Box};
export function ExplorerOrganized(){
  const t=useT(),objects=useEditor(s=>s.project.objects),selectedIds=useEditor(s=>s.selectedIds),select=useEditor(s=>s.selectObject);
  const selected=useEditor(s=>s.selected),setSelected=useEditor(s=>s.setSelected),toggleVisibility=useEditor(s=>s.toggleVisibility),toggleLocked=useEditor(s=>s.toggleLocked);
  const routeSolo=useEditor(s=>s.routeSolo),setRouteSolo=useEditor(s=>s.setRouteSolo);
  const startWaypoint=useEditor(s=>s.startWaypointPlacement),focus=useEditor(s=>s.issueCameraCommand);
  const tree=useMemo(()=>organizeScene(objects),[objects]);
  const [query,setQuery]=useState(''),[limits,setLimits]=useState<Record<string,number>>({}),[collapsed,setCollapsed]=useState<Record<string,boolean>>({geometry:false,npc:false,spawners:false,'routes':false,audio:false,lighting:false,triggers:false,brushentities:false,items:false,other:true,orphan:true});
  const test=(o:MapObject)=>[o.name,o.kind==='entity'?o.classname:'',o.kind==='entity'?o.props.targetname:'',o.layer||''].some(s=>s.toLowerCase().includes(query.toLowerCase()));
  const open=(key:string)=>query.trim()?true:!collapsed[key];
  const flip=(key:string)=>setCollapsed(v=>({...v,[key]:!v[key]}));
  const jump=(id:string,event?:MouseEvent)=>{select(id,!!(event?.ctrlKey||event?.shiftKey||event?.metaKey));};
  const context=(event:MouseEvent,o:MapObject)=>{event.preventDefault();event.stopPropagation();if(!selectedIds.includes(o.id))setSelected(o.id);document.dispatchEvent(new CustomEvent('svenstudio:explorer-context',{detail:{x:event.clientX,y:event.clientY,objectId:o.id}}));};
  const item=(o:MapObject,depth=1,note?:string)=> <div key={`${depth}-${o.id}`} className={`tree-item explorer-organized-item ${selectedIds.includes(o.id)?'selected':''}`} style={{paddingLeft:12+depth*12}}
    onClick={event=>jump(o.id,event)} onDoubleClick={()=>{setSelected(o.id);focus('frame')}} onContextMenu={event=>context(event,o)} title={o.kind==='entity'?`${o.classname} — ${o.props.targetname||'unnamed'}`:o.name}>
    {o.kind==='entity'?<UserRound size={13}/>:<Box size={13}/>}
    <span className="explorer-object-details"><strong>{o.name}</strong>{o.kind==='entity'&&<small>{o.classname}{note?` · ${note}`:''}</small>}{o.kind==='brush'&&note&&<small>{note}</small>}</span>
    <button title={t('Toggle visibility')} className="tree-action" onClick={e=>{e.stopPropagation();toggleVisibility(o.id)}}>{o.hidden?<EyeOff size={13}/>:<Eye size={13}/>}</button>
    <button title={t('Toggle lock')} className="tree-action" onClick={e=>{e.stopPropagation();toggleLocked(o.id)}}>{o.locked?<Lock size={13}/>:<Unlock size={13}/>}</button>
  </div>;
  const folder=(key:string,label:string,count:number,Icon:typeof Box,children:ReactNode)=> <section className="scene-hierarchy-group" key={key}>
    <button className="tree-folder scene-hierarchy-heading" onClick={()=>flip(key)}>{open(key)?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<Icon size={15}/><span>{t(label)}</span><small>{count}</small></button>
    {open(key)&&children}
  </section>;
  const groupNode=(g:SceneGroup)=>{const filtered=g.items.filter(o=>o.kind==='entity'&&test(o));if(!filtered.length)return null;const Icon=icons[g.id]||Box;const limit=limits[g.id]||120;return folder(g.id,g.name,filtered.length,Icon,<>{filtered.slice(0,limit).map(o=>item(o))}{filtered.length>limit&&<button className="explorer-load-more" onClick={()=>setLimits(v=>({...v,[g.id]:limit+120}))}>{t('Show more entities')} ({filtered.length-limit})</button>}</>)};
  const includedRoutes=tree.routes.filter(r=>!query||r.name.toLowerCase().includes(query.toLowerCase())||r.nodes.some(test)||r.owners.some(test));
  return <div className="explorer scene-hierarchy">
    <div className="panel-header"><span><FolderTree size={15}/> {t('Explorer')} · {t('Scene')}</span><span className="counter">{objects.filter(o=>o.kind==='entity').length}</span></div>
    <div className="search-field compact"><Search size={14}/><input placeholder={t('Filter objects...')} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')} title="Clear search"><FilterX size={14}/></button>}</div>
    <div className="explorer-quickbar"><span><Route size={14}/>{tree.routes.length} {t('Routes')}</span><span>{tree.orphanWaypoints.length} {t('Unassigned')}</span>{routeSolo&&<button onClick={()=>setRouteSolo(null)}><Eye size={13}/>{t('Show all')}</button>}</div>
    <div className="explorer-tree"><div className="tree-root"><Layers size={15}/><strong>{t('Workspace')}</strong><small>{selectedIds.length>1?`${selectedIds.length} ${t('selected')}`:''}</small></div>
      {folder('routes','AI Routes',includedRoutes.length+tree.orphanWaypoints.length,Route,<>
        {includedRoutes.map(r=><section key={r.key} className={`route-group ${routeSolo===r.key?'route-focus':''}`} style={{'--route-color':routeColor(r.key)} as CSSProperties}>
          <div className="route-heading"><span className="route-swatch"/><button className="route-title" onClick={()=>flip('route:'+r.key)} title={r.name}>{open('route:'+r.key)?<ChevronDown size={12}/>:<ChevronRight size={12}/>}<strong>{r.name}</strong><small>{r.nodes.length} wp</small></button>
            <button className={routeSolo===r.key?'route-action active':'route-action'} onClick={()=>setRouteSolo(routeSolo===r.key?null:r.key)} title={t('Isolate route in 3D')}><Eye size={14}/></button>
          </div>
          {open('route:'+r.key)&&<div className="route-contents">
            <div className="route-owners-label"><Users size={12}/>{r.owners.length} {t('Route users')}{r.shared&&<b>{t('Shared route')}</b>}</div>
            {r.owners.map(o=>item(o,2,`${t('Owner')} · path_name`))}
            {r.nodes.map((o,index)=>item(o,2,`#${index+1} · ${o.props.targetname||'?'}`))}
            {(r.broken||r.loop)&&<p className="route-warning"><AlertTriangle size={13}/>{r.broken?t('Broken route connection'):t('Looped route')}</p>}
            {r.owners[0]&&<button className="route-add" onClick={()=>startWaypoint(r.owners[0].id)}><MapPin size={13}/>{t('Add waypoint to route')}</button>}
          </div>}
        </section>)}
        {tree.orphanWaypoints.length>0&&folder('orphan',t('Unassigned waypoints'),tree.orphanWaypoints.length,AlertTriangle,<>{tree.orphanWaypoints.filter(o=>!query||test(o)).map(o=>item(o,2,t('No NPC route references this waypoint')))}</>)}
      </>)}
      {tree.groups.filter(g=>g.id!=='geometry').map(groupNode)}
    </div>
  </div>;
}
