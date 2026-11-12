import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Combine,Focus,RefreshCw,Unlink,X} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {buildCurvedRamp,defaultCurveSettings,validateCurveSettings,type CurveSettings,type RadialArrayOptions} from '../engine/curvedGeometry';
import type {Brush,Vec3} from '../engine/types';

export function CurvedGeometryPanel({onClose,embedded=false}:{onClose:()=>void;embedded?:boolean}){
  const t=useT(),project=useEditor(s=>s.project),ids=useEditor(s=>s.selectedIds),create=useEditor(s=>s.createCurvedRamp),update=useEditor(s=>s.updateCurvedRamp),detach=useEditor(s=>s.detachCurvedRamp),array=useEditor(s=>s.radialArraySelected),focus=useEditor(s=>s.issueCameraCommand);
  const selected=project.objects.filter((o):o is Brush=>ids.includes(o.id)&&o.kind==='brush');
  const existing=project.curveAssemblies?.find(record=>record.memberIds.some(id=>ids.includes(id)));
  // The path generator in World Builder is the primary ramp/bridge creator.
  // Keep legacy curves editable; new work here defaults to the non-duplicated radial array.
  const [mode,setMode]=useState<'ramp'|'array'>(existing?'ramp':'array');
  const [settings,setSettings]=useState<CurveSettings>(()=>existing?structuredClone(existing.options):{...defaultCurveSettings,origin:selected[0]?[...selected[0].position]:[0,0,96]});
  const [copies,setCopies]=useState(8),[status,setStatus]=useState('');
  useEffect(()=>{if(embedded)return;const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose()}};window.addEventListener('keydown',esc,true);return()=>window.removeEventListener('keydown',esc,true)},[onClose,embedded]);
  const updateNumber=(key:keyof CurveSettings,value:number)=>setSettings(s=>({...s,[key]:value}));
  const issues=useMemo(()=>validateCurveSettings(settings),[settings]);
  const preview=useMemo(()=>{if(mode==='array')return {error:!selected.length?t('Select at least one brush in the editor.'):selected.length*copies>512?t('Reduce copies: maximum 512 brushes.'):copies<2||copies>64||!Number.isInteger(copies)?t('Choose between 2 and 64 copies.'):null,count:selected.length*copies};try{
    if(issues.length)return {error:issues[0],count:0};const pieces=buildCurvedRamp(settings);return {error:'',count:pieces.length};
  }catch(error){return {error:String(error),count:0}}},[mode,selected.length,copies,settings,issues,t]);
  const action=()=>{try{if(mode==='ramp'){if(existing)update(existing.id,settings);else create(settings)}else{
    const options:RadialArrayOptions={origin:settings.origin,radius:settings.radius,sweep:settings.sweep,rise:settings.rise,startAngle:settings.startAngle,copies};
    array(options);
  }onClose()}catch(error){setStatus(String(error))}};
  const setOrigin=(axis:number,value:number)=>setSettings(s=>({...s,origin:s.origin.map((n,i)=>i===axis?value:n) as Vec3}));
  const start=(settings.startAngle)*Math.PI/180,end=(settings.startAngle+settings.sweep)*Math.PI/180;
  const pts=Array.from({length:Math.max(3,settings.segments)+1},(_,i)=>{
    const a=start+(end-start)*i/Math.max(3,settings.segments);
    return {x:240+Math.cos(a)*Math.min(155,settings.radius*.4),y:156-Math.sin(a)*Math.min(115,settings.radius*.4)-settings.rise*(i/Math.max(3,settings.segments))*.02};
  });
  const panel=<section className="bw-dialog cg-dialog" role={embedded?'region':'dialog'} aria-modal={embedded?undefined:true} aria-label={t('Advanced Curved Geometry')}>

      <header className="bw-header"><div><strong>{t('Advanced Curved Geometry')}</strong><small>{t('Closed convex GoldSrc brushes · live preview and Undo')}</small></div><div className="bw-header-actions">{!embedded&&<button onClick={()=>focus('frame')} title={t('Frame selection')}><Focus size={18}/></button>}<button onClick={onClose} aria-label={t('Close')}><X size={22}/></button></div></header>
      <div className="bw-main"><div className="bw-view">
        <div className="bw-view-title">{t('Curve plan')}<small>{t('Illustrative plan view; geometry is generated as convex brushes')}</small></div>
        <svg className="bw-canvas" viewBox="0 0 480 312" role="img" aria-label={t('Curve plan')}>
          <rect width="480" height="312" fill="#102437"/>
          {Array.from({length:15},(_,i)=><path key={`a${i}`} d={`M ${i*32} 0 V312`} stroke="#315069" strokeWidth=".8"/>)}
          {Array.from({length:10},(_,i)=><path key={`b${i}`} d={`M 0 ${i*32} H480`} stroke="#315069" strokeWidth=".8"/>)}
          <path d={pts.map((p,i)=>(i?'L':'M')+`${p.x},${p.y}`).join(' ')} stroke="#2bbad0" strokeWidth={Math.max(3,Math.min(38,settings.width*.13))} opacity=".6" fill="none" strokeLinejoin="round"/>
          <path d={pts.map((p,i)=>(i?'L':'M')+`${p.x},${p.y}`).join(' ')} stroke="#a9f2fa" strokeWidth="1.6" fill="none"/>
          {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill="#e4f8ff"/>)}
          <circle cx="240" cy="156" r="5" stroke="#fbda83" strokeWidth="2" fill="none"/><path d="M230 156 H250 M240 146V166" stroke="#fbda83" strokeWidth="1.5"/>
        </svg>
        <p className="bw-hint">{mode==='ramp'?t('A curved ramp is divided into two triangular prisms per segment to keep all faces planar.'):t('Radial Array makes rigid copies. Original brushes are not bent or deleted.')}</p>
        {existing&&<div className="bw-status success">{t('Editing a saved parametric curve. Manual changes are protected against overwrite.')}</div>}
      </div><aside className="bw-controls">
        <div className="bw-subtitle">{t('Geometry type')}</div>
        <div className="bw-op-grid">{existing&&<button className={mode==='ramp'?'active':''} onClick={()=>setMode('ramp')}><Combine size={17}/>{t('Edit saved curved ramp')}</button>}<button className={mode==='array'?'active':''} onClick={()=>setMode('array')}><RefreshCw size={17}/>{t('Radial Array')}</button></div>
        {!existing&&<p className="bw-hint">{t('For new curved roads, ramps, tunnels and bridges, use Routes & Structures in World Builder. Radial Array repeats selected brushes without deforming them.')}</p>}
        <div className="bw-fields">
          <label>{t('Radius')} (u)<input type="number" value={settings.radius} min={32} max={8192} onChange={e=>updateNumber('radius',Number(e.target.value))}/></label>
          <label>{t('Sweep angle')} (°)<input type="number" value={settings.sweep} min={-360} max={360} onChange={e=>updateNumber('sweep',Number(e.target.value))}/></label>
          <label>{t('Elevation')} (u)<input type="number" value={settings.rise} min={-8192} max={8192} onChange={e=>updateNumber('rise',Number(e.target.value))}/></label>
          <label>{t('Start angle')} (°)<input type="number" value={settings.startAngle} onChange={e=>updateNumber('startAngle',Number(e.target.value))}/></label>
          {mode==='ramp'?<>
            <label>{t('Width')} (u)<input type="number" min={8} value={settings.width} onChange={e=>updateNumber('width',Number(e.target.value))}/></label>
            <label>{t('Thickness')} (u)<input type="number" min={2} value={settings.thickness} onChange={e=>updateNumber('thickness',Number(e.target.value))}/></label>
            <label>{t('Segments')}<input type="number" min={3} max={64} value={settings.segments} onChange={e=>updateNumber('segments',Number(e.target.value))}/></label>
            <label>{t('Texture')}<input value={settings.texture} onChange={e=>setSettings(s=>({...s,texture:e.target.value.toUpperCase()}))}/></label>
          </>:<label>{t('Copies')}<input type="number" min={2} max={64} value={copies} onChange={e=>setCopies(Number(e.target.value))}/></label>}
        </div>
        <div className="bw-subtitle">{t('Position')} (X, Y, Z)</div>
        <div className="cg-position">{settings.origin.map((v,i)=><label key={i}>{'XYZ'[i]}<input type="number" value={v} onChange={e=>setOrigin(i,Number(e.target.value))}/></label>)}</div>
        <div className={`bw-status ${preview.error?'error':'success'}`} role="status">{preview.error||`${preview.count} ${t('brushes')} · ${t('Valid preview')}`}</div>
        {status&&<div className="bw-status error" role="alert">{status}</div>}
        <p className="bw-disclaimer">{t('The project retains editable curve parameters. The exported MAP contains ordinary brushes.')}</p>
        <div className="bw-footer">{existing&&mode==='ramp'&&<button onClick={()=>{try{detach(existing.id);onClose()}catch(e){setStatus(String(e))}}}><Unlink size={17}/>{t('Detach curve')}</button>}<button onClick={onClose}>{t('Cancel')}</button><button className="bw-confirm" disabled={!!preview.error||!Number.isInteger(copies)||copies>64||copies<2} onClick={action}><Check size={17}/>{t(existing&&mode==='ramp'?'Update curve':'Generate geometry')}</button></div>
      </aside></div>
    </section>;
  return embedded?<div className="wb-curve-embedded" onPointerDown={e=>e.stopPropagation()}>{panel}</div>:createPortal(<div className="bw-backdrop" onPointerDown={e=>e.stopPropagation()}>{panel}</div>,document.body);
}
