/** v2.6 Logic simulator page for Gameplay Studio: pick a starting entity, get the firing timeline,
 * play it back in real time and jump to any entity in the map. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {Play,Pause,RotateCcw,Crosshair,AlertTriangle} from 'lucide-react';
import {useT} from '../i18n';
import {simulateLogic,LOGIC_STARTERS} from '../engine/logicSimulator';
import type {MapObject,PointEntity} from '../engine/types';

const ICON:Record<string,string>={open:'🚪',close:'🚪',sound:'🔊',text:'💬',effect:'✨',random:'🎲',count:'🔢',master:'🔐',blocked:'⛔',missing:'❓',removed:'✖',spawn:'👾',level:'🗺',manager:'📋',trigger:'⚡',press:'🔘'};

export function LogicSimulatorPanel({objects,selectedId,onSelect}:{objects:readonly MapObject[];selectedId:string|null;onSelect:(id:string)=>void}){
  const t=useT();
  const starters=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'&&LOGIC_STARTERS.test(o.classname)).slice(0,400),[objects]);
  const selectedEntity=objects.find(o=>o.id===selectedId&&o.kind==='entity') as PointEntity|undefined;
  const [start,setStart]=useState<string>(()=>selectedEntity&&LOGIC_STARTERS.test(selectedEntity.classname)?selectedEntity.id:starters[0]?.id??'');
  const [seed,setSeed]=useState(7);const [clock,setClock]=useState<number|null>(null);
  const result=useMemo(()=>start?simulateLogic(objects,start,{seed}):null,[objects,start,seed]);
  const raf=useRef(0);
  useEffect(()=>{if(clock===null)return;const t0=performance.now()-clock*1000;
    const tick=()=>{const now=(performance.now()-t0)/1000;if(result&&now>result.duration+1){setClock(null);return;}setClock(now);raf.current=requestAnimationFrame(tick);};
    raf.current=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf.current);},[clock===null,result]);
  const label=(e:PointEntity)=>`${e.props.targetname||'(no name)'} · ${e.classname}`;
  return <div className="logic-sim">
    <div className="logic-sim-bar">
      <label>{t('Start from')}<select value={start} onChange={e=>{setStart(e.target.value);setClock(null);}}>{starters.map(e=><option key={e.id} value={e.id}>{label(e)}</option>)}</select></label>
      {selectedEntity&&selectedEntity.id!==start&&<button type="button" onClick={()=>{setStart(selectedEntity.id);setClock(null);}}><Crosshair size={13}/>{t('Use selected')}</button>}
      <button type="button" disabled={!result?.events.length} onClick={()=>setClock(clock===null?0:null)}>{clock===null?<Play size={13}/>:<Pause size={13}/>}{clock===null?t('Play'):t('Stop')}</button>
      <button type="button" title={t('Re-roll random choices')} onClick={()=>{setSeed(s=>s+1);setClock(null);}}><RotateCcw size={13}/>{t('New random roll')}</button>
      {clock!==null&&<b className="logic-sim-clock">{clock.toFixed(1)} s</b>}
    </div>
    {!starters.length&&<p className="gds-empty">{t('This map has no buttons, triggers or relays to start from.')}</p>}
    {result?.warnings.map((w,i)=><p key={i} className="gds-caution"><AlertTriangle size={13}/>{t(w)}</p>)}
    <div className="logic-sim-list">{result?.events.map((ev,i)=>{const past=clock!==null&&ev.time<=clock;const now=clock!==null&&past&&(result.events[i+1]?.time??Infinity)>clock;
      return <button type="button" key={i} disabled={!ev.entityId} className={`logic-sim-row${past?' past':''}${now?' now':''} ${ev.action}`} style={{paddingLeft:8+Math.min(ev.depth,10)*12}} onClick={()=>ev.entityId&&onSelect(ev.entityId)}>
        <span className="logic-sim-time">{ev.time.toFixed(2)} s</span><span className="logic-sim-icon">{ICON[ev.action]??'•'}</span>
        <strong>{ev.name||ev.classname}</strong><small>{ev.classname} · {t(ev.action)} · {ev.detail}</small></button>;})}</div>
    <p className="gds-note">{t('Editor simulation of the entity chain (targets, delays, masters, counters, random). Physics, AI and players are not simulated.')}</p>
  </div>;
}
