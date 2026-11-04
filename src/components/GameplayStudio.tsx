import {useEffect,useMemo,useRef,useState} from 'react';
import type React from 'react';
import {Activity,ArrowRight,Box,CheckCircle2,CircleHelp,DoorClosed,GitBranch,Layers,Link2,MousePointer2,Plus,RotateCcw,Save,Unlink2,Variable,AlertTriangle, X,ZoomIn,ZoomOut} from 'lucide-react';
import {useEditor} from '../store';
import {analyzeGameplay,getConnections} from '../engine/gameplay';
import type {PointEntity} from '../engine/types';
import {useT} from '../i18n';

const NW=218, NH=106, SW=1760,SH=1300;
type NodePosition={x:number;y:number};
const colorOf=(e:PointEntity)=>e.classname.startsWith('func_')?'#66d8fd':e.classname.startsWith('trigger_')?'#a78dff':e.classname.startsWith('monster_')?'#fb708f':'#72dfba';
function startingPositions(entities:PointEntity[]):Record<string,NodePosition>{
  const rows=[0,0,0];
  return Object.fromEntries(entities.map(e=>{
    let col=0;
    if(e.classname==='func_button'||e.classname.startsWith('trigger_once')||e.classname==='trigger_multiple'){col=0;}
    else if(e.classname.startsWith('trigger_')){col=1;}
    else if(e.classname==='func_door'||e.classname==='func_door_rotating'){col=2;}
    return [e.id,{x:45+col*365,y:68+(rows[col]++)*154}];
  }));
}
function Editable({label,value,onCommit,type='text'}:{label:string;value:string;onCommit:(value:string)=>void;type?:string}){
  const [draft,setDraft]=useState(value);
  useEffect(()=>setDraft(value),[value]);
  return <label className="gs-input"><span>{label}</span><input type={type} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(value!==draft)onCommit(draft)}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();e.stopPropagation()}}/></label>;
}
export function GameplayStudio({onClose}:{onClose:()=>void}){
  const t=useT();
  const project=useEditor(s=>s.project),selected=useEditor(s=>s.selected);
  const setSelected=useEditor(s=>s.setSelected),setProp=useEditor(s=>s.setObjectProp);
  const tie=useEditor(s=>s.tieGameplayBrush),relay=useEditor(s=>s.createGameplayRelay);
  const addDemo=useEditor(s=>s.addGameplayDemo),connect=useEditor(s=>s.connectGameplay),disconnect=useEditor(s=>s.disconnectGameplay);
  const setGraphPosition=useEditor(s=>s.setGraphPosition),undo=useEditor(s=>s.undo),redo=useEditor(s=>s.redo);
  const objects=project.objects;
  const entities=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'),[objects]);
  const edges=useMemo(()=>getConnections(objects),[objects]);
  const warnings=useMemo(()=>analyzeGameplay(objects),[objects]);
  const defaultPositions=useMemo(()=>startingPositions(entities),[entities]);
  const [draggingPos,setDraggingPos]=useState<Record<string,NodePosition>>({});
  const [active,setActive]=useState<string|null>(null),[source,setSource]=useState<string|null>(null);
  const [showAll,setShowAll]=useState(true),[zoom,setZoom]=useState(1),[notice,setNotice]=useState('');
  const stageRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<{id:string;startX:number;startY:number;origin:NodePosition}|null>(null);
  const positions=useMemo(()=>Object.fromEntries(entities.map(e=>{
    const p=draggingPos[e.id]||project.graphPositions?.[e.id]||[defaultPositions[e.id]?.x??50,defaultPositions[e.id]?.y??50];
    return [e.id,Array.isArray(p)?{x:p[0],y:p[1]}:p];
  })) as Record<string,NodePosition>,[entities,draggingPos,project.graphPositions,defaultPositions]);
  // Expand the graph vertically for maps with many entities; never clip nodes beyond row 8.
  const canvasHeight=useMemo(()=>Math.max(SH,...Object.values(positions).map(pos=>pos.y+NH+70)),[positions]);
  const selectedEntity=entities.find(e=>e.id===(active||selected));
  const selectedBrush=objects.find(o=>o.id===selected&&o.kind==='brush');
  const visible=showAll?entities:entities.filter(e=>['func_button','func_door','func_door_rotating','trigger_relay','trigger_once','trigger_multiple'].includes(e.classname)||!!e.props.target||!!e.props.targetname);
  useEffect(()=>{
    const onMove=(event:PointerEvent)=>{
      const drag=dragRef.current;if(!drag)return;
      setDraggingPos(p=>({...p,[drag.id]:{x:Math.max(12,Math.min(SW-NW-12,drag.origin.x+(event.clientX-drag.startX)/zoom)),y:Math.max(12,Math.min(canvasHeight-NH-12,drag.origin.y+(event.clientY-drag.startY)/zoom))}}));
    };
    const onUp=(event:PointerEvent)=>{
      const drag=dragRef.current;if(!drag)return;
      const pos={x:Math.max(12,Math.min(SW-NW-12,drag.origin.x+(event.clientX-drag.startX)/zoom)),y:Math.max(12,Math.min(canvasHeight-NH-12,drag.origin.y+(event.clientY-drag.startY)/zoom))};
      setGraphPosition(drag.id,[Math.round(pos.x),Math.round(pos.y)]);
      setDraggingPos(p=>{const next={...p};delete next[drag.id];return next});dragRef.current=null;
    };
    window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);
    return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp)};
  },[zoom,canvasHeight,setGraphPosition]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(source)setSource(null);else onClose()}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)},[source,onClose]);
  const act=(action:()=>void)=>{try{action();setNotice('')}catch(error){setNotice(String(error instanceof Error?error.message:error))}};
  const beginSource=(id:string)=>{setSource(id);setActive(id);setSelected(id);setNotice('')};
  const endTarget=(id:string)=>{
    if(!source){setActive(id);setSelected(id);return;}
    if(source===id){setSource(null);return;}
    try{connect(source,id)}catch(error){
      const msg=String(error instanceof Error?error.message:error);
      if(msg.includes('already targets')&&window.confirm(`${msg}\n\n${t('Replace existing connection?')}`))act(()=>connect(source,id,true));
      else setNotice(msg);
    }
    setSource(null);setActive(id);
  };
  const convert=(type:'func_door'|'func_button')=>{
    if(!selectedBrush){setNotice(t('Select an unassigned brush in the 3D viewport first.'));return;}
    act(()=>{tie(selectedBrush.id,type);setActive(null)});
  };
  const addRelay=()=>{const o=objects.find(o=>o.id===selected);act(()=>{relay(o?[o.position[0],o.position[1],o.position[2]+48]:[0,0,96]);setActive(null)})};
  return <div className="modal-backdrop gs-backdrop" onMouseDown={onClose}>
    <div className="gs-shell" role="dialog" aria-modal="true" aria-label="Gameplay Studio" onMouseDown={e=>e.stopPropagation()}>
      <header className="gs-topbar">
        <span className="gs-logo"><GitBranch size={20}/></span><div><strong>{t('Gameplay Studio')}</strong><small>Svengine · target → targetname · Valve 220</small></div>
        <span className="gs-top-count"><Activity size={14}/>{entities.length} {t('entities')} · {edges.length} {t('connections')}</span>
        <button title={t('Undo')} onClick={undo}><RotateCcw size={17}/></button><button title={t('Close')} onClick={onClose}><X size={20}/></button>
      </header>
      <div className="gs-layout">
        <aside className="gs-sidebar">
          <h3><Box size={15}/>{t('Quick gameplay tools')}</h3>
          <p>{t('Select a free brush in the 3D viewport, then convert it into a Svengine brush entity.')}</p>
          <button onClick={()=>convert('func_door')}><DoorClosed size={18}/><span>{t('Create sliding door')}<small>func_door</small></span><Plus size={14}/></button>
          <button onClick={()=>convert('func_button')}><MousePointer2 size={18}/><span>{t('Create button')}<small>func_button · spawnflags 1</small></span><Plus size={14}/></button>
          <button onClick={addRelay}><GitBranch size={18}/><span>{t('Create relay')}<small>trigger_relay</small></span><Plus size={14}/></button>
          <div className="gs-section-line"/>
          <button className="gs-demo" onClick={()=>act(addDemo)}><CheckCircle2 size={18}/><span>{t('Add playable example')}<small>func_button → trigger_relay → func_door</small></span></button>
          <p>{t('The example adds new brushes inside the room. It does not cut a doorway into an existing wall.')}</p>
          <div className="gs-section-line"/>
          <h3><CircleHelp size={15}/>{t('Connecting nodes')}</h3>
          <p>{t('Click the output circle on a source node, then the input circle on its target. The link is saved as real target / targetname keyvalues.')}</p>
          {source&&<button className="gs-cancel" onClick={()=>setSource(null)}>{t('Cancel connection')} <X size={14}/></button>}
          <label className="gs-checkbox"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> {t('Show all entities')}</label>
        </aside>
        <main className="gs-center">
          <div className="gs-canvas-tools"><span><GitBranch size={14}/>{t('Visual Trigger Editor')}</span><span className="gs-status">{source?t('Choose a destination node…'):t('Drag nodes by their headers')}</span>
            <div className="gs-zoom"><button onClick={()=>setZoom(z=>Math.max(.65,Number((z-.1).toFixed(2))))}><ZoomOut size={16}/></button><b>{Math.round(zoom*100)}%</b><button onClick={()=>setZoom(z=>Math.min(1.4,Number((z+.1).toFixed(2))))}><ZoomIn size={16}/></button></div>
          </div>
          <div className="gs-viewport" ref={stageRef}><div className="gs-stage" style={{width:SW*zoom,height:canvasHeight*zoom}}>
            <div className="gs-world" style={{width:SW,height:canvasHeight,transform:`scale(${zoom})`,transformOrigin:'top left'}}>
              <svg className="gs-wires" width={SW} height={canvasHeight} aria-hidden="true">
                {edges.map(e=>{const from=positions[e.from],to=positions[e.to];if(!from||!to||!visible.some(v=>v.id===e.from)||!visible.some(v=>v.id===e.to))return null;
                  const x1=from.x+NW,y1=from.y+62,x2=to.x,y2=to.y+62,dx=Math.max(95,Math.abs(x2-x1)*.5);
                  return <path key={`${e.from}:${e.to}`} d={`M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`} stroke={active===e.from||active===e.to?'#85f8df':'#66cbbf'} strokeWidth="2.5" fill="none" strokeOpacity=".8"/>;
                })}
              </svg>
              {visible.map(e=>{const pos=positions[e.id];const color=colorOf(e),linked=edges.filter(edge=>edge.from===e.id).length;
                return <div className={`gs-node ${active===e.id?'is-active':''} ${source===e.id?'is-source':''}`} key={e.id} style={{left:pos?.x||0,top:pos?.y||0,'--node-color':color} as React.CSSProperties}>
                  <button className="gs-port gs-in" title={t('Connect to this input')} onClick={()=>endTarget(e.id)}><span/></button>
                  <div className="gs-node-head" onPointerDown={ev=>{if(ev.button!==0)return;dragRef.current={id:e.id,startX:ev.clientX,startY:ev.clientY,origin:pos};ev.preventDefault();setActive(e.id);setSelected(e.id)}} onClick={()=>{setActive(e.id);setSelected(e.id)}}>
                    <span className="gs-node-icon"><Variable size={16}/></span><strong title={e.classname}>{e.classname}</strong>
                    <small>{linked>0?linked:''}</small>
                  </div>
                  <div className="gs-node-body" onClick={()=>{setActive(e.id);setSelected(e.id)}}>
                    <span>{e.props.targetname||t('Unnamed')}</span><small title={e.props.target||''}>{e.props.target?`→ ${e.props.target}`:t('No outgoing target')}</small>
                  </div>
                  <button className="gs-port gs-out" title={t('Connect this output')} onClick={()=>beginSource(e.id)}><span/></button>
                </div>;
              })}
            </div>
          </div></div>
        </main>
        <aside className="gs-inspector">
          <h3><Layers size={16}/>{t('Gameplay Inspector')}</h3>
          {selectedEntity?<>
            <div className="gs-entity-title"><span className="gs-entity-dot" style={{background:colorOf(selectedEntity)}}/><strong>{selectedEntity.classname}</strong><small>{selectedEntity.name}</small></div>
            <Editable label="targetname" value={selectedEntity.props.targetname||''} onCommit={v=>setProp(selectedEntity.id,'targetname',v)}/>
            <Editable label="target" value={selectedEntity.props.target||''} onCommit={v=>setProp(selectedEntity.id,'target',v)}/>
            {(['speed','wait','lip','angle','delay','triggerstate'] as const).filter(key=>key in selectedEntity.props).map(key=><Editable key={key} label={key} value={selectedEntity.props[key]||''} onCommit={v=>setProp(selectedEntity.id,key,v)}/>)}
            <button className="gs-unlink" disabled={!selectedEntity.props.target} onClick={()=>act(()=>disconnect(selectedEntity.id))}><Unlink2 size={15}/>{t('Clear outgoing connection')}</button>
            <p>{t('All edits are saved in the map project and exported as Svengine keyvalues.')}</p>
          </>:<div className="gs-inspector-empty"><MousePointer2 size={26}/><p>{t('Select a node to inspect its keyvalues.')}</p></div>}
          <div className="gs-section-line"/>
          <h3><AlertTriangle size={15}/>{t('Gameplay validation')} <b>{warnings.length}</b></h3>
          <div className="gs-issues">{warnings.length===0?<p className="gs-good"><CheckCircle2 size={16}/>{t('No gameplay reference issues detected.')}</p>:warnings.map((issue,i)=><button key={`${issue.entityId||''}:${i}`} className={`gs-issue ${issue.severity}`} onClick={()=>{setActive(issue.entityId||null);if(issue.entityId)setSelected(issue.entityId)}}><AlertTriangle size={14}/>{issue.message}</button>)}</div>
          {notice&&<div className="gs-error" role="alert">{notice}</div>}
        </aside>
      </div>
      <footer className="gs-footer"><span><CheckCircle2 size={14}/>{t('Native Svengine connections — not a simulated scripting engine')}</span><span>{t('Export and compile normally with SC-CSG / BSP / VIS / RAD')} <ArrowRight size={14}/></span></footer>
    </div>
  </div>;
}
