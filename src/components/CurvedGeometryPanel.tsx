import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Combine,Focus,RefreshCw,Unlink,X,Rows3} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {buildCurvedRamp,defaultCurveSettings,validateCurveSettings,radialArrayBrushes,linearArrayBrushes,type CurveSettings,type RadialArrayOptions,type LinearArrayOptions} from '../engine/curvedGeometry';
import {BrushPreview} from './BrushPreview';
import {defaultTerrain} from '../engine/terrain';
import {MousePointer2} from 'lucide-react';
import {brushDimensions} from '../engine/geometry';
import type {Brush,Vec3} from '../engine/types';

export function CurvedGeometryPanel({onClose,embedded=false,onPlace}:{onClose:()=>void;embedded?:boolean;onPlace?:()=>void}){
  const t=useT(),project=useEditor(s=>s.project),ids=useEditor(s=>s.selectedIds),create=useEditor(s=>s.createCurvedRamp),update=useEditor(s=>s.updateCurvedRamp),detach=useEditor(s=>s.detachCurvedRamp),array=useEditor(s=>s.radialArraySelected),linearArray=useEditor(s=>s.linearArraySelected),focus=useEditor(s=>s.issueCameraCommand);
  const selected=project.objects.filter((o):o is Brush=>ids.includes(o.id)&&o.kind==='brush');
  const existing=project.curveAssemblies?.find(record=>record.memberIds.some(id=>ids.includes(id)));
  // The path generator in World Builder is the primary ramp/bridge creator.
  // Keep legacy curves editable; new work here defaults to the non-duplicated radial array.
  const [mode,setMode]=useState<'ramp'|'array'|'linear'>(existing?'ramp':'array');
  const [settings,setSettings]=useState<CurveSettings>(()=>existing?structuredClone(existing.options):{...defaultCurveSettings,origin:selected[0]?[...selected[0].position]:[0,0,96]});
  const [copies,setCopies]=useState(8),[status,setStatus]=useState('');
  // Linear array: default step = the selection's width on X, so copies sit side by side.
  const [offset,setOffset]=useState<Vec3>(()=>[selected[0]?Math.max(16,Math.round(brushDimensions(selected[0])[0]*selected[0].scale[0])):64,0,0]);
  const [linearCopies,setLinearCopies]=useState(4),[yawStep,setYawStep]=useState(0);
  useEffect(()=>{if(embedded)return;const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose()}};window.addEventListener('keydown',esc,true);return()=>window.removeEventListener('keydown',esc,true)},[onClose,embedded]);
  const updateNumber=(key:keyof CurveSettings,value:number)=>setSettings(s=>({...s,[key]:value}));
  const issues=useMemo(()=>validateCurveSettings(settings),[settings]);
  const preview=useMemo(()=>{if(mode==='linear')return {error:!selected.length?t('Select at least one brush in the editor.'):selected.length*linearCopies>512?t('Reduce copies: maximum 512 brushes.'):linearCopies<1||linearCopies>64||!Number.isInteger(linearCopies)?t('Choose between 1 and 64 copies.'):offset.every(v=>v===0)&&yawStep===0?t('Set an offset or a rotation step: copies would overlap the originals.'):null,count:selected.length*linearCopies};
    if(mode==='array')return {error:!selected.length?t('Select at least one brush in the editor.'):selected.length*copies>512?t('Reduce copies: maximum 512 brushes.'):copies<2||copies>64||!Number.isInteger(copies)?t('Choose between 2 and 64 copies.'):null,count:selected.length*copies};try{
    if(issues.length)return {error:issues[0],count:0};const pieces=buildCurvedRamp(settings);return {error:'',count:pieces.length};
  }catch(error){return {error:String(error),count:0}}},[mode,selected.length,copies,settings,issues,t,linearCopies,offset,yawStep]);
  const action=()=>{try{if(mode==='linear'){const options:LinearArrayOptions={offset,copies:linearCopies,yawStep};linearArray(options);}else if(mode==='ramp'){if(existing)update(existing.id,settings);else create(settings)}else{
    const options:RadialArrayOptions={origin:settings.origin,radius:settings.radius,sweep:settings.sweep,rise:settings.rise,startAngle:settings.startAngle,copies};
    array(options);
  }onClose()}catch(error){setStatus(String(error))}};
  // v2.4: real 3D preview of what will be generated (originals highlighted in yellow).
  const radialOptions:RadialArrayOptions={origin:settings.origin,radius:settings.radius,sweep:settings.sweep,rise:settings.rise,startAngle:settings.startAngle,copies};
  const preview3d=useMemo(()=>{
    try{
      if(mode==='ramp')return {brushes:buildCurvedRamp(settings),originals:[] as Brush[]};
      if(!selected.length||preview.error)return {brushes:[] as Brush[],originals:selected};
      if(mode==='linear')return {brushes:linearArrayBrushes(selected,{offset,copies:linearCopies,yawStep}),originals:selected};
      return {brushes:radialArrayBrushes(selected,radialOptions),originals:selected};
    }catch{return {brushes:[] as Brush[],originals:selected};}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[mode,settings,selected.map(b=>b.id).join(','),copies,linearCopies,offset,yawStep,preview.error]);
  const pickCentre=()=>{
    try{
      if(preview.error)throw Error(preview.error);
      useEditor.getState().startTerrainPlacement({kind:'radial',draft:defaultTerrain(),radial:radialOptions});
      (onPlace??onClose)();
    }catch(error){setStatus(String(error instanceof Error?error.message:error))}
  };
  const setOrigin=(axis:number,value:number)=>setSettings(s=>({...s,origin:s.origin.map((n,i)=>i===axis?value:n) as Vec3}));
  const panel=<section className="bw-dialog cg-dialog" role={embedded?'region':'dialog'} aria-modal={embedded?undefined:true} aria-label={t('Advanced Curved Geometry')}>

      <header className="bw-header"><div><strong>{t('Advanced Curved Geometry')}</strong><small>{t('Closed convex GoldSrc brushes · live preview and Undo')}</small></div><div className="bw-header-actions">{!embedded&&<button onClick={()=>focus('frame')} title={t('Frame selection')}><Focus size={18}/></button>}<button onClick={onClose} aria-label={t('Close')}><X size={22}/></button></div></header>
      <div className="bw-main"><div className="bw-view">
        <div className="bw-view-title">{t('Interactive preview')}<small>{t('Yellow: your selection · grey: what will be created')}</small></div>
        <BrushPreview height={312} brushes={preview3d.brushes} highlight={preview3d.originals} label={preview3d.brushes.length?`${preview3d.brushes.length} ${t('brushes')} · ${t('Drag to orbit; wheel to zoom.')}`:t('Select at least one brush in the editor.')}/>
        <p className="bw-hint">{mode==='linear'?t('Linear Array makes rigid copies in a straight line: each copy moves by the offset and can turn by the rotation step. Originals are kept.'):mode==='ramp'?t('A curved ramp is divided into two triangular prisms per segment to keep all faces planar.'):t('Radial Array makes rigid copies. Original brushes are not bent or deleted.')}</p>
        {existing&&<div className="bw-status success">{t('Editing a saved parametric curve. Manual changes are protected against overwrite.')}</div>}
      </div><aside className="bw-controls">
        <div className="bw-subtitle">{t('Geometry type')}</div>
        <div className="bw-op-grid">{existing&&<button className={mode==='ramp'?'active':''} onClick={()=>setMode('ramp')}><Combine size={17}/>{t('Edit saved curved ramp')}</button>}<button className={mode==='array'?'active':''} onClick={()=>setMode('array')}><RefreshCw size={17}/>{t('Radial Array')}</button><button className={mode==='linear'?'active':''} onClick={()=>setMode('linear')}><Rows3 size={17}/>{t('Linear Array')}</button></div>
        {!existing&&<p className="bw-hint">{t('For new curved roads, ramps, tunnels and bridges, use Routes & Structures in World Builder. Radial Array repeats selected brushes without deforming them.')}</p>}
        {mode==='linear'?<div className="bw-fields">
          {offset.map((v,i)=><label key={i}>{t('Offset')} {'XYZ'[i]} (u)<input type="number" value={v} min={-8192} max={8192} onChange={e=>setOffset(o=>o.map((n,j)=>j===i?Number(e.target.value):n) as Vec3)}/></label>)}
          <label>{t('Copies')}<input type="number" min={1} max={64} value={linearCopies} onChange={e=>setLinearCopies(Number(e.target.value))}/></label>
          <label>{t('Rotation step')} (°)<input type="number" min={-360} max={360} value={yawStep} onChange={e=>setYawStep(Number(e.target.value))}/></label>
        </div>:<><div className="bw-fields">
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
        {mode==='array'&&<button type="button" className="cg-pick-centre" disabled={!!preview.error} onClick={pickCentre}><MousePointer2 size={15}/>{t('Choose the arc centre by clicking the map')}</button>}
        <div className="cg-position">{settings.origin.map((v,i)=><label key={i}>{'XYZ'[i]}<input type="number" value={v} onChange={e=>setOrigin(i,Number(e.target.value))}/></label>)}</div></>}
        <div className={`bw-status ${preview.error?'error':'success'}`} role="status">{preview.error||`${preview.count} ${t('brushes')} · ${t('Valid preview')}`}</div>
        {status&&<div className="bw-status error" role="alert">{status}</div>}
        <p className="bw-disclaimer">{t('The project retains editable curve parameters. The exported MAP contains ordinary brushes.')}</p>
        <div className="bw-footer">{existing&&mode==='ramp'&&<button onClick={()=>{try{detach(existing.id);onClose()}catch(e){setStatus(String(e))}}}><Unlink size={17}/>{t('Detach curve')}</button>}<button onClick={onClose}>{t('Cancel')}</button><button className="bw-confirm" disabled={!!preview.error||(mode==='array'&&(!Number.isInteger(copies)||copies>64||copies<2))} onClick={action}><Check size={17}/>{t(existing&&mode==='ramp'?'Update curve':'Generate geometry')}</button></div>
      </aside></div>
    </section>;
  return embedded?<div className="wb-curve-embedded" onPointerDown={e=>e.stopPropagation()}>{panel}</div>:createPortal(<div className="bw-backdrop" onPointerDown={e=>e.stopPropagation()}>{panel}</div>,document.body);
}
