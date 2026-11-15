import {useEffect,useMemo} from 'react';
import {AlertTriangle,CheckCircle2,Pause,Play,RotateCcw,Route,X} from 'lucide-react';
import {useEditor} from '../store';
import {useMotionPreview} from '../entityMotionPreviewState';
import {createEntityMotionPlan,motionCollisionHints} from '../engine/entityMotionPreview';
import {motionLabels} from '../engine/entityMotionPreviewLabels';
import './entityMotionPreview.css';

/** Lightweight HUD: controls are outside the Canvas; project data is read-only. */
function ActiveEntityMotionPreviewPanel({sourceId}:{sourceId:string}){
 const progress=useMotionPreview(s=>s.progress),playing=useMotionPreview(s=>s.playing);
 const speed=useMotionPreview(s=>s.speed),showPath=useMotionPreview(s=>s.showPath);
 const close=useMotionPreview(s=>s.close),setProgress=useMotionPreview(s=>s.setProgress),setPlaying=useMotionPreview(s=>s.setPlaying),setSpeed=useMotionPreview(s=>s.setSpeed),togglePath=useMotionPreview(s=>s.togglePath);
 const objects=useEditor(s=>s.project.objects),locale=useEditor(s=>s.locale),walkMode=useEditor(s=>s.walkMode);
 const tx=motionLabels(locale);
 const plan=useMemo(()=>createEntityMotionPlan(objects,sourceId),[objects,sourceId]);
 useEffect(()=>{if(!objects.some(e=>e.kind==='entity'&&e.id===sourceId))close()},[sourceId,objects,close]);
 const collision=useMemo(()=>plan&&plan.tracks.length?motionCollisionHints(plan,objects):[],[plan,objects]);
 if(walkMode||!plan)return null;
 const source=objects.find(e=>e.kind==='entity'&&e.id===sourceId),warnings=[...plan.warnings,...collision,...plan.tracks.flatMap(t=>t.notes)];
 const available=plan.tracks.length>0;
 return <section className="hf18-motion-panel" role="region" aria-label={tx.title} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
  <header><Route size={16}/><strong>{tx.title}</strong><button type="button" aria-label={tx.close} title={tx.close} onClick={close}><X size={17}/></button></header>
  <div className="hf18-motion-body">
   <p className="hf18-motion-source"><strong>{source&&source.kind==='entity'?(source.props.targetname||source.name||source.classname):sourceId}</strong><small>{source?.kind==='entity'?source.classname:''}</small></p>
   <p className="hf18-motion-status"><CheckCircle2 size={14}/>{tx.status} · {plan.tracks.length} {tx.motion.toLowerCase()}</p>
   {available?<>
    <div className="hf18-motion-row"><button type="button" onClick={()=>{if(progress>=1)setProgress(0);setPlaying(!playing||progress>=1)}}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?tx.pause:tx.play}</button><button type="button" onClick={()=>{setPlaying(false);setProgress(0)}}><RotateCcw size={15}/>{tx.restart}</button></div>
    <label className="hf18-motion-slider"><span>{tx.time}: {Math.round(progress*100)}% · {(progress*plan.duration).toFixed(2)}s / {plan.duration.toFixed(2)}s</span><input type="range" min="0" max="1000" step="1" value={Math.round(progress*1000)} onChange={e=>{setPlaying(false);setProgress(Number(e.target.value)/1000)}}/></label>
    <div className="hf18-motion-options"><label>{tx.speed}<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.25}>0.25×</option><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label><label><input type="checkbox" checked={showPath} onChange={togglePath}/>{tx.trajectory}</label></div>
    <div className="hf18-motion-track-list">{plan.tracks.map(t=><div key={t.entityId}><strong>{t.classname}</strong><span>{t.brushIds.length} {tx.geometry.toLowerCase()} · {t.duration.toFixed(2)}s</span></div>)}</div>
    {plan.activatedIds.length>1&&<p className="hf18-motion-chain">{tx.activated}: {plan.activatedIds.length}</p>}
   </>:<p className="hf18-motion-warning">{tx.missing}</p>}
   {warnings.length>0&&<details className="hf18-motion-warning" open={!available}><summary><AlertTriangle size={14}/>{tx.checks} ({warnings.length})</summary>{warnings.slice(0,12).map((w,i)=><p key={i}>{w}</p>)}</details>}
   <p className="hf18-motion-disclaimer">{tx.note}</p>
  </div>
 </section>;
}

export function EntityMotionPreviewPanel(){
 const sourceId=useMotionPreview(s=>s.sourceId);
 return sourceId?<ActiveEntityMotionPreviewPanel key={sourceId} sourceId={sourceId}/>:null;
}
