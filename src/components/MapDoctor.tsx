import {useMemo,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,Eye,EyeOff,FileUp,Focus,Search,ShieldCheck,Trash2,X} from 'lucide-react';
import {useEditor} from '../store';
import {analyzeMap,type MapIssue} from '../engine/mapDiagnostics';
import {analyzeBuildLog,parsePointfile,renderDoctorMessage} from '../engine/compileDiagnostics';
import {useMapDoctorState} from '../mapDoctorState';
import {useT} from '../i18n';
export function MapDoctor({onClose}:{onClose:()=>void}){
 const t=useT(),editor=useEditor(),[severity,setSeverity]=useState<'all'|MapIssue['severity']>('all');
 const input=useRef<HTMLInputElement>(null),[importMessage,setImportMessage]=useState('');
 const trace=useMapDoctorState(s=>s.trace),traceVisible=useMapDoctorState(s=>s.traceVisible);
 const traceOrigin=useMapDoctorState(s=>s.traceOrigin),mapName=useMapDoctorState(s=>s.mapName);
 const lines=useMapDoctorState(s=>s.lines),setTraceVisible=useMapDoctorState(s=>s.setTraceVisible),clearTrace=useMapDoctorState(s=>s.clearTrace);
 const loadTrace=useMapDoctorState(s=>s.loadTrace),focusTrace=useMapDoctorState(s=>s.focusTrace);
 const buildFindings=useMemo(()=>analyzeBuildLog(lines),[lines]);
 const report=useMemo(()=>analyzeMap(editor.project,editor.textureAssets,editor.fgdClasses,editor.fgdLoaded),[editor.project,editor.textureAssets,editor.fgdClasses,editor.fgdLoaded]);
 const filtered=report.issues.filter(i=>severity==='all'||i.severity===severity);
 const localizeIssue=(issue:MapIssue)=>renderDoctorMessage(t(issue.template||issue.message),issue.params);
 const count=(kind:MapIssue['severity'])=>report.issues.filter(i=>i.severity===kind).length;
 const openPointfile=async(file:File|undefined)=>{
  if(!file)return;
  if(!/\.(pts|lin)$/i.test(file.name)||file.size>1024*1024){setImportMessage(t('Invalid pointfile. Use a .pts or .lin file smaller than 1 MB.'));return;}
  try{
   const points=parsePointfile(await file.text());
   if(points.length<2){setImportMessage(t('The pointfile contains no usable route.'));return;}
   loadTrace(points,file.name);setImportMessage(t('Pointfile loaded into viewport.'));
  }catch{setImportMessage(t('The pointfile could not be read.'));}
 };
 return <div className="modal-backdrop" onMouseDown={onClose}><section className="map-doctor" role="dialog" aria-modal="true" aria-label={t('Map Doctor')} onMouseDown={e=>e.stopPropagation()}>
  <header><ShieldCheck size={22}/><strong>{t('Map Doctor')} 2.0 · Svengine</strong><button title={t('Close')} onClick={onClose}><X size={18}/></button></header>
  <p>{t('Map Doctor checks editable geometry and summarizes real compiler errors. A pointfile from SC-BSP reveals the diagnosed leak route; static checks alone cannot prove a map is sealed.')}</p>
  <div className="map-doctor-stats"><span>{report.brushes} {t('brushes')}</span><span>{report.entities} {t('entities')}</span><span>{report.faces} {t('Faces')}</span><span>{report.textures} {t('Texture')}</span></div>
  <section className="doctor-trace-panel">
    <div className="doctor-trace-heading"><strong>{t('Leak pointfile route')}</strong><small>{mapName||t('Current map')} · {traceOrigin||t('No pointfile loaded')}</small></div>
    <p>{trace.length?`${trace.length} ${t('route points')}`:t('Compile a leaking map or import a .pts/.lin pointfile to see the route.')}</p>
    <input ref={input} type="file" accept=".pts,.lin" hidden onChange={event=>{void openPointfile(event.target.files?.[0]);event.target.value='';}}/>
    <div className="doctor-actions">
      <button onClick={()=>input.current?.click()}><FileUp size={14}/> {t('Import pointfile')}</button>
      <button onClick={()=>setTraceVisible(!traceVisible)} disabled={!trace.length}>{traceVisible?<EyeOff size={14}/>:<Eye size={14}/>} {t(traceVisible?'Hide leak route':'Show leak route')}</button>
      <button onClick={()=>{focusTrace(0);onClose()}} disabled={!trace.length}><Focus size={14}/> {t('Focus route start')}</button>
      <button onClick={()=>{focusTrace(trace.length-1);onClose()}} disabled={!trace.length}><Focus size={14}/> {t('Focus route end')}</button>
      <button onClick={()=>{clearTrace();setImportMessage('')}} disabled={!trace.length}><Trash2 size={14}/> {t('Clear route')}</button>
    </div>
    {importMessage&&<small role="status">{importMessage}</small>}
    <small>{t('Pointfiles describe a compiler path from an entity to outside, not the exact brush causing the hole. Trace endpoints are diagnostic clues.')}</small>
  </section>
  {lines.length>0&&<section className="doctor-build-report">
    <strong>{t('Last compilation findings')} ({buildFindings.length})</strong>
    {buildFindings.length?buildFindings.map(f=><div className={`doctor-build-finding ${f.severity}`} key={f.code}><b>{f.stage?`SC-${f.stage} · `:''}{f.code}</b><span>{renderDoctorMessage(t(f.messageKey),f.params)}</span></div>):<p>{t('No recognized compiler errors in the last build. Check the full output log for other issues.')}</p>}
  </section>}
  <strong className="doctor-section-title">{t('Preflight checks')}</strong>
  <nav>{(['all','error','warning','info'] as const).map(kind=><button className={severity===kind?'active':''} key={kind} onClick={()=>setSeverity(kind)}>{t(kind==='all'?'All issues':kind==='error'?'Errors':kind==='warning'?'Warnings':'Information')} ({kind==='all'?report.issues.length:count(kind)})</button>)}</nav>
  <div className="map-doctor-issues">{filtered.map((issue,i)=><button key={`${issue.code}-${issue.objectId||i}`} onClick={()=>{if(issue.objectId){editor.setSelected(issue.objectId);editor.issueCameraCommand('frame');onClose()}}} className={`map-doctor-issue ${issue.severity}`} disabled={!issue.objectId}>
    {issue.severity==='error'?<AlertTriangle size={16}/>:issue.severity==='warning'?<Search size={16}/>:<CheckCircle2 size={16}/>}<span><strong>{t(issue.category[0].toUpperCase()+issue.category.slice(1))} · {issue.code}</strong><small>{localizeIssue(issue)}</small></span></button>)}
   {!filtered.length&&<p>{t('No findings for this filter.')}</p>}</div>
  <footer><button onClick={()=>editor.appendLogs([`Map Doctor: ${count('error')} errors, ${count('warning')} warnings, ${count('info')} notices.`,...buildFindings.map(f=>`[${f.code}] ${renderDoctorMessage(t(f.messageKey),f.params)}`)])}>{t('Write summary to build log')}</button><button onClick={onClose}>{t('Close')}</button></footer>
 </section></div>;
}
