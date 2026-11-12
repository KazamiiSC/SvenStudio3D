import {useEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {Box,Check,ChevronDown,ChevronUp,Focus,MousePointer2,RotateCcw,Scissors,Square,X,Eye,PenTool,Layers} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {planWorkshop,workshopFootprint,workshopFrame,type WorkshopOperation,type WorkshopShape,type WorkshopProfile} from '../engine/brushWorkshop';
import {BrushWorkshopPreview3D,type WorkshopCameraPreset} from './BrushWorkshopPreview3D';
import type {Brush} from '../engine/types';

const fmt=(n:number)=>Math.round(n*100)/100;
function blank(brush:Brush,face:number):WorkshopShape{
  const f=workshopFrame(brush,face);
  return {u:0,v:0,width:Math.max(4,Math.min(96,(f.maxU-f.minU)*.42)),height:Math.max(4,Math.min(96,(f.maxV-f.minV)*.42)),depth:12,frame:8,profile:'rectangle',segments:16};
}
function initialFace(brush:Brush|null,selectedFace:number|null):number{
  if(!brush)return 0;
  if(selectedFace!==null&&selectedFace>=0&&selectedFace<brush.faces.length)return selectedFace;
  // Prefer a wall face if no explicit face was selected (face zero can be the underside).
  return brush.faces.findIndex((_,i)=>{try{return Math.abs(workshopFrame(brush,i).normal[2])<.65}catch{return false}})>=0
    ?brush.faces.findIndex((_,i)=>{try{return Math.abs(workshopFrame(brush,i).normal[2])<.65}catch{return false}}):0;
}
const ops:{id:WorkshopOperation;title:string;description:string}[]=[
  {id:'panel',title:'Raised panel',description:'Draw a solid detail attached to the face.'},
  {id:'recess',title:'Recess',description:'Remove a shallow volume from this brush.'},
  {id:'opening',title:'Cut through',description:'Carve a complete opening through this brush.'},
  {id:'frame',title:'Add frame',description:'Add frame segments around the drawing.'},
  {id:'framed-opening',title:'Opening + frame',description:'Carve a hole and place its frame in one Undo step.'}
];
const profiles:{id:WorkshopProfile;label:string}[]=[{id:'rectangle',label:'Rectangle'},{id:'circle',label:'Circle'},{id:'ellipse',label:'Ellipse'},{id:'polygon',label:'Regular polygon'},{id:'rounded',label:'Rounded rectangle'}];
export function BrushWorkshop({onClose}:{onClose:()=>void}){
  const t=useT(),objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected),selectedFace=useEditor(s=>s.selectedFace);
  const apply=useEditor(s=>s.applyBrushWorkshop),log=useEditor(s=>s.appendLogs);
  const brush=objects.find((o):o is Brush=>o.id===selected&&o.kind==='brush')??null;
  const [face,setFace]=useState(()=>initialFace(brush,selectedFace));
  const [operation,setOperation]=useState<WorkshopOperation>('panel');
  const [settings,setSettings]=useState<WorkshopShape>(()=>brush?blank(brush,initialFace(brush,selectedFace)):{u:0,v:0,width:64,height:64,depth:12,frame:8,profile:'rectangle',segments:16});
  const [status,setStatus]=useState(''),[showAdvanced,setShowAdvanced]=useState(false);
  const [view,setView]=useState<'3d'|'draw'>('3d'),[preset,setPreset]=useState<WorkshopCameraPreset>('iso'),[showSource,setShowSource]=useState(true);
  const pointer=useRef<{u:number;v:number}|null>(null);
  const frame=useMemo(()=>{if(!brush)return null;try{return workshopFrame(brush,face)}catch{return null}},[brush,face]);
  const preview=useMemo(()=>{if(!brush||!frame)return {error:'Select a valid brush face.',count:0,result:null};try{
    const result=planWorkshop(brush,face,operation,settings);
    return {error:'',count:(result.replacement?.length??0)+result.additions.length,result};
  }catch(error){return {error:String(error instanceof Error?error.message:error),count:0,result:null}}},[brush,frame,face,operation,settings]);
  useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose()}};
    window.addEventListener('keydown',esc,true);return()=>window.removeEventListener('keydown',esc,true)},[onClose]);
  const selectFace=(index:number)=>{if(!brush)return;setFace(index);setSettings(previous=>({...blank(brush,index),profile:previous.profile,segments:previous.segments}));setStatus('')};
  const update=(key:keyof WorkshopShape,value:number)=>setSettings(s=>({...s,[key]:Number.isFinite(value)?value:0,...(s.profile==='circle'&&(key==='width'||key==='height')?{width:value,height:value}:{})}));
  const setProfile=(profile:WorkshopProfile)=>setSettings(s=>({...s,profile,...(profile==='circle'?{height:s.width}:{})}));
  const w=690,h=380;
  const minU=frame?.minU??-64,maxU=frame?.maxU??64,minV=frame?.minV??-64,maxV=frame?.maxV??64;
  const scale=Math.min((w-48)/Math.max(1,maxU-minU),(h-48)/Math.max(1,maxV-minV));
  const px=(u:number)=>w/2+(u-(minU+maxU)/2)*scale;
  const py=(v:number)=>h/2-(v-(minV+maxV)/2)*scale;
  const fromPointer=(e:PointerEvent<SVGSVGElement>)=>{
    const rect=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-rect.left)*w/rect.width,y=(e.clientY-rect.top)*h/rect.height;
    return {u:(x-w/2)/scale+(minU+maxU)/2,v:(h/2-y)/scale+(minV+maxV)/2};
  };
  const down=(e:PointerEvent<SVGSVGElement>)=>{if(e.button!==0||!frame)return;e.preventDefault();e.stopPropagation();const p=fromPointer(e);pointer.current=p;e.currentTarget.setPointerCapture(e.pointerId);
    setSettings(s=>({...s,u:fmt(p.u),v:fmt(p.v),width:4,height:4}));};
  const move=(e:PointerEvent<SVGSVGElement>)=>{if(!pointer.current)return;e.preventDefault();const p=fromPointer(e),start=pointer.current;
    const width=Math.max(4,fmt(Math.abs(p.u-start.u))),height=Math.max(4,fmt(Math.abs(p.v-start.v)));
    setSettings(s=>({...s,u:fmt((p.u+start.u)/2),v:fmt((p.v+start.v)/2),width,height:s.profile==='circle'?width:height}));};
  const up=(e:PointerEvent<SVGSVGElement>)=>{if(pointer.current){pointer.current=null;e.currentTarget.releasePointerCapture(e.pointerId)}};
  const commit=()=>{if(!brush||preview.error)return;try{apply(brush.id,face,operation,settings);log([`Brush Workshop: ${operation} completed on ${brush.name}.`]);onClose()}catch(error){setStatus(String(error))}};
  const shapeOutline=useMemo(()=>{try{return workshopFootprint(settings).map(([x,y])=>`${px(x+settings.u)},${py(y+settings.v)}`).join(' ')}catch{return ''}},[settings,minU,maxU,minV,maxV,scale]);
  return createPortal(<div className="bw-backdrop" onPointerDown={e=>e.stopPropagation()}>
    <section className="bw-dialog bw-dialog-v2" role="dialog" aria-modal="true" aria-label={t('Brush Workshop')}>
      <header className="bw-header"><div><strong>{t('Brush Workshop')}</strong><small>{brush?.name??t('Select a brush')} · {t('3D geometry preview')}</small></div>
        <div className="bw-header-actions"><button onClick={()=>setPreset('iso')} title={t('Reset camera')}><Focus size={18}/></button><button onClick={onClose} aria-label={t('Close')}><X size={22}/></button></div></header>
      {!brush?<div className="bw-empty">{t('Select an unlocked brush in the map, then reopen Brush Workshop.')}</div>:<div className="bw-main">
        <div className="bw-view">
          <div className="bw-view-tabs" role="tablist"><button role="tab" aria-selected={view==='3d'} className={view==='3d'?'active':''} onClick={()=>setView('3d')}><Eye size={17}/>{t('3D preview')}</button>
            <button role="tab" aria-selected={view==='draw'} className={view==='draw'?'active':''} onClick={()=>setView('draw')}><PenTool size={17}/>{t('Draw on face')}</button></div>
          {view==='3d'?<>
            <div className="bw-camera-presets"><button className={preset==='iso'?'active':''} onClick={()=>setPreset('iso')}>{t('Perspective')}</button>
              <button className={preset==='face'?'active':''} onClick={()=>setPreset('face')}>{t('Face view')}</button>
              <button className={preset==='top'?'active':''} onClick={()=>setPreset('top')}>{t('Top')}</button>
              <button className={preset==='side'?'active':''} onClick={()=>setPreset('side')}>{t('Side')}</button>
              <label><input type="checkbox" checked={showSource} onChange={e=>setShowSource(e.target.checked)}/>{t('Show original')}</label></div>
            <BrushWorkshopPreview3D brush={brush} face={face} frame={frame} result={preview.result} preset={preset} onFaceSelect={selectFace} showSource={showSource}/>
            <div className="bw-hint">{t('Rotate, pan and zoom freely. Click a face to select it; switch to Draw on face to sketch.')}</div>
          </>:<>
            <div className="bw-view-title"><MousePointer2 size={17}/>{t('Draw directly on the selected face')}<small>{t('Drag to mark the edit area')}</small></div>
            <svg viewBox={`0 0 ${w} ${h}`} className="bw-canvas" role="img" aria-label={t('Face editing canvas')}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={e=>e.preventDefault()}>
              <defs><pattern id="bw-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#416078" strokeWidth=".8"/></pattern></defs>
              <rect width={w} height={h} fill="#102437"/><rect width={w} height={h} fill="url(#bw-grid)"/>
              {frame&&<polygon points={frame.outline.map(p=>`${px(p[0])},${py(p[1])}`).join(' ')} fill="#47728a" fillOpacity=".5" stroke="#97e5f3" strokeWidth="2.5"/>}
              <polygon points={shapeOutline} fill={preview.error?'#e47b65':'#36c6db'} fillOpacity=".35" stroke={preview.error?'#ffad9b':'#71e7f2'} strokeWidth="2.7" strokeDasharray="8 4"/>
              <line x1={px(settings.u)-11} x2={px(settings.u)+11} y1={py(settings.v)} y2={py(settings.v)} stroke="#f4d27e" strokeWidth="2"/>
              <line x1={px(settings.u)} x2={px(settings.u)} y1={py(settings.v)-11} y2={py(settings.v)+11} stroke="#f4d27e" strokeWidth="2"/>
            </svg>
            <div className="bw-hint">{t('Draw with the left mouse button. Values can be adjusted precisely on the right.')}</div>
          </>}
        </div>
        <aside className="bw-controls">
          <div className="bw-subtitle">{t('Edit face')}</div>
          <select value={face} onChange={e=>selectFace(Number(e.target.value))} className="bw-select" aria-label={t('Edit face')}>
            {brush.faces.map((f,i)=><option value={i} key={i}>{t('Face')} {i+1} · {f.texture}</option>)}
          </select>
          <div className="bw-subtitle">{t('Brush operation')}</div>
          <div className="bw-op-grid">{ops.map(op=><button key={op.id} className={operation===op.id?'active':''} onClick={()=>setOperation(op.id)} title={t(op.description)}>
            {op.id==='panel'?<Box size={17}/>:op.id==='recess'||op.id==='opening'?<Scissors size={17}/>:<Square size={17}/>}<span>{t(op.title)}</span></button>)}</div>
          <div className="bw-subtitle">{t('Shape profile')}</div>
          <div className="bw-shape-grid">{profiles.map(p=><button key={p.id} aria-pressed={settings.profile===p.id} className={settings.profile===p.id?'active':''} onClick={()=>setProfile(p.id)}>{t(p.label)}</button>)}</div>
          <div className="bw-fields"><label>{settings.profile==='circle'?t('Diameter'):t('Width')} (u)<input type="number" min="4" max="8192" value={fmt(settings.width)} onChange={e=>update('width',Number(e.target.value))}/></label>
            {settings.profile!=='circle'&&<label>{t('Height')} (u)<input type="number" min="4" max="8192" value={fmt(settings.height)} onChange={e=>update('height',Number(e.target.value))}/></label>}
            <label>{t('Depth')} (u)<input type="number" min="1" max="8192" value={fmt(settings.depth)} onChange={e=>update('depth',Number(e.target.value))}/></label>
            {(operation==='frame'||operation==='framed-opening')&&<label>{t('Frame border')} (u)<input type="number" min="1" value={settings.frame} onChange={e=>update('frame',Number(e.target.value))}/></label>}</div>
          {settings.profile!=='rectangle'&&<div className="bw-quality"><div><label htmlFor="bw-segments">{t('Curve detail / segments')}</label><strong>{settings.segments??16}</strong></div>
            <input id="bw-segments" type="range" min={settings.profile==='polygon'?3:8} max="64" step="1" value={settings.segments??16} onChange={e=>update('segments',Number(e.target.value))}/>
            <small>{t('Higher detail creates more GoldSrc brush faces and may compile more slowly.')}</small></div>}
          <button className="bw-advanced" onClick={()=>setShowAdvanced(v=>!v)}>{showAdvanced?<ChevronUp size={16}/>:<ChevronDown size={16}/>} {t('Exact offsets')}</button>
          {showAdvanced&&<div className="bw-fields"><label>{t('Horizontal offset')} (u)<input type="number" value={fmt(settings.u)} onChange={e=>update('u',Number(e.target.value))}/></label><label>{t('Vertical offset')} (u)<input type="number" value={fmt(settings.v)} onChange={e=>update('v',Number(e.target.value))}/></label></div>}
          <div role="status" className={`bw-status ${preview.error?'error':'success'}`}>{preview.error||`${t('Valid preview')} · ${preview.count} ${t('brushes')}`}</div>
          {status&&<div role="alert" className="bw-status error">{status}</div>}
          <p className="bw-disclaimer">{t('Geometry stays convex. Cutting may create multiple solids. Undo restores the original brush.')}</p>
          <div className="bw-footer"><button onClick={onClose}>{t('Cancel')}</button><button className="bw-confirm" disabled={!!preview.error} onClick={commit}><Check size={17}/>{t('Apply changes')}</button></div>
        </aside>
      </div>}
    </section>
  </div>,document.body);
}
