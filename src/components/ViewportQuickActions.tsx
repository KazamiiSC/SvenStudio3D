/** View actions of the single viewport bar (v2.3 HF8 reorganization).
 * One home per action: undo/redo, snap, wireframe, ghosts and entity names live in the
 * top Tools ribbon; this group only holds what changes how you LOOK at the map.
 * Items carry a priority class: on narrow viewports (150% Windows scaling, 4-view layout)
 * vbar-p3 and then vbar-p2 items move into the "More" menu instead of overlapping.
 * During a modal G/R/S transform every button is disabled so it can never interrupt it.
 */
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Eye,EyeOff,Focus,Maximize2,Crosshair,SquareDashed,CloudSun,LayoutGrid,MoreHorizontal} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {displayBinding} from '../engine/controls';

type Prio='p1'|'p2'|'p3';
function Action({label,onClick,disabled=false,pressed,badge,prio='p1',showLabel=false,children}:{label:string;onClick:()=>void;disabled?:boolean;pressed?:boolean;badge?:number|string;prio?:Prio;showLabel?:boolean;children:ReactNode}){
  return <button type="button" className={`vqa-button vbar-${prio}${pressed?' is-on':''}`} title={label} aria-label={label}
    aria-pressed={pressed===undefined?undefined:pressed} disabled={disabled}
    onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onClick();}}>
    {children}{showLabel&&<span className="vbar-menu-label">{label}</span>}{badge?<span className={`vqa-badge${badge==='!'?' vqa-warn':''}`}>{typeof badge==='number'&&badge>99?'99+':badge}</span>:null}
  </button>;
}

type ViewAction={key:string;prio:Prio;sep:boolean;node:ReactNode};
function useViewActions(showLabel:boolean):ViewAction[]{
  const t=useT();
  const hiddenCount=useEditor(s=>s.project.objects.reduce((n,o)=>n+(o.hidden?1:0),0));
  const selectedCount=useEditor(s=>s.selectedIds.length);
  // "Showing hidden" is on while at least one object it revealed is still visible (undo may have re-hidden them).
  const revealing=useEditor(s=>{const ids=s.revealedHiddenIds;if(!ids)return false;const set=new Set(ids);return s.project.objects.some(o=>set.has(o.id)&&!o.hidden);});
  const isolating=useEditor(s=>s.isolationSnapshot!==null);
  const busy=useEditor(s=>s.modalTransform!==null);
  const region=useEditor(s=>s.compileRegion!==null);
  const quad=useEditor(s=>!!s.settings.quadView);
  const sky=useEditor(s=>!!s.settings.editorSkybox),skyStatus=useEditor(s=>s.editorSkyStatus),skyname=useEditor(s=>s.project.world.skyname||'');
  const skyProblem=skyStatus==='missing'?t('The six skybox textures were not found for this skyname.'):skyStatus==='no-game'?t('Set the game folder in Build Settings to see the skybox.'):skyStatus==='none'?t('The map has no skyname.'):skyStatus==='error'?t('Could not load the installed skybox textures.'):'';
  const shortcuts=useEditor(s=>s.controls.shortcuts);
  const key=(id:keyof typeof shortcuts)=>shortcuts[id]?` [${displayBinding(shortcuts[id])}]`:'';
  const run=(action:(state:ReturnType<typeof useEditor.getState>)=>void)=>()=>{if(!useEditor.getState().modalTransform)action(useEditor.getState());};
  const a=(key:string,prio:Prio,sep:boolean,props:Omit<Parameters<typeof Action>[0],'prio'|'showLabel'>):ViewAction=>({key,prio,sep,node:<Action key={key} prio={prio} showLabel={showLabel} {...props}/>});
  return [
    a('frameSel','p1',false,{label:`${t('Frame selection')}${key('frame')}`,disabled:busy||!selectedCount,onClick:run(s=>s.issueCameraCommand('frame')),children:<Focus size={16}/>}),
    a('frameAll','p1',false,{label:`${t('Frame whole map')}${key('frameAll')}`,disabled:busy,onClick:run(s=>s.issueCameraCommand('frameAll')),children:<Maximize2 size={16}/>}),
    a('quad','p2',false,{label:`${quad?t('Back to the single 3D view'):t('4 views: Top, Front, Side and 3D')}${key('quadView')}`,pressed:quad,disabled:busy,onClick:run(s=>s.setSettings({quadView:!s.settings.quadView})),children:<LayoutGrid size={16}/>}),
    a('reveal','p1',true,{label:revealing?t('Hide them again'):t('Show hidden objects'),pressed:revealing,badge:revealing?undefined:hiddenCount,disabled:busy||(!hiddenCount&&!revealing),onClick:run(s=>s.toggleRevealHidden()),children:<Eye size={16}/>}),
    a('hide','p2',false,{label:`${t('Hide selection')} (H)`,disabled:busy||!selectedCount,onClick:run(s=>s.hideSelection()),children:<EyeOff size={16}/>}),
    a('isolate','p2',false,{label:isolating?t('Exit isolation'):`${t('Isolate selection')} (Num /)`,pressed:isolating,disabled:busy||(!selectedCount&&!isolating),onClick:run(s=>s.toggleTemporaryIsolation()),children:<Crosshair size={16}/>}),
    a('sky','p3',true,{label:`${sky?t('Hide the skybox'):t('Show the map skybox')}${skyname?` (${skyname})`:''}${key('skybox')}${sky&&skyProblem?` — ${skyProblem}`:''}`,pressed:sky,badge:sky&&skyProblem?'!':undefined,disabled:busy,onClick:run(s=>s.setSettings({editorSkybox:!s.settings.editorSkybox})),children:<CloudSun size={16}/>}),
    a('region','p3',false,{label:`${region?t('Compile the whole map again (remove compile region)'):t('Compile only around the selection (compile region)')}${key('compileRegion')}`,pressed:region,disabled:busy||(!region&&!selectedCount),onClick:run(s=>region?s.clearCompileRegion():s.setCompileRegionFromSelection()),children:<SquareDashed size={16}/>}),
  ];
}

/** Inline group inside the viewport bar. */
export function ViewportQuickActions(){
  const t=useT();
  const items=useViewActions(false);
  return <div className="viewport-quick-actions" role="group" aria-label={t('Quick actions')}>
    {items.flatMap(item=>item.sep?[<span key={`${item.key}-sep`} className={`vqa-separator vbar-${item.prio}`} aria-hidden="true"/>,item.node]:[item.node])}
  </div>;
}

/** "More" menu: lists, with their names, the actions hidden by the narrow-viewport rules. */
export function ViewportMoreMenu({extra}:{extra?:ReactNode}){
  const t=useT();
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const items=useViewActions(true);
  useEffect(()=>{
    if(!open)return;
    const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',close,true);window.addEventListener('keydown',esc);
    return()=>{document.removeEventListener('pointerdown',close,true);window.removeEventListener('keydown',esc);};
  },[open]);
  return <div className="vbar-more" ref={root}>
    <button type="button" className={`vqa-button${open?' is-on':''}`} aria-haspopup="menu" aria-expanded={open} title={t('More view options')} aria-label={t('More view options')}
      onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setOpen(v=>!v);}}><MoreHorizontal size={16}/></button>
    {open&&<div className="vbar-more-menu" role="menu" onPointerDown={e=>e.stopPropagation()}>
      {items.filter(item=>item.prio!=='p1').map(item=>item.node)}
      {extra}
    </div>}
  </div>;
}
