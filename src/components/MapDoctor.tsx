import {useMemo,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,Eye,EyeOff,FileUp,Focus,Search,ShieldCheck,Trash2,X} from 'lucide-react';
import {useEditor} from '../store';
import {analyzeMap,type MapIssue} from '../engine/mapDiagnostics';
import {analyzeBuildLog,parsePointfile,renderDoctorMessage} from '../engine/compileDiagnostics';
import {useMapDoctorState} from '../mapDoctorState';
import {useT} from '../i18n';
import {CoopPlaytestPanel} from './CoopPlaytestPanel';
import {CSMapHF33Audit} from './CSMapHF33';
import {openMapTool} from './MapToolsDialogs';
import {analyzeOptimization,convertToDetail} from '../engine/mapOptimizer';
import {analyzeReachability,type ReachReport} from '../engine/mapTools24';
export function MapDoctor({onClose}:{onClose:()=>void}){
 const t=useT(),editor=useEditor(),[severity,setSeverity]=useState<'all'|MapIssue['severity']>('all'),[tab,setTab]=useState<'general'|'coop'|'player'|'optimize'|'reach'>('general');
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
 if(editor.settings.gameProfile==='cs16')return <div className="modal-backdrop" onMouseDown={onClose}><section className="map-doctor" role="dialog" aria-modal="true" aria-label="CS Map Doctor 2.0" onMouseDown={e=>e.stopPropagation()}>
  <header><ShieldCheck size={22}/><strong>CS Map Doctor 2.0 · GoldSrc / ZHLT</strong><button title={t('Close')} onClick={onClose}><X size={18}/></button></header>
  <div className="cs33-standalone-doctor"><CSMapHF33Audit locale={editor.locale} mapName={editor.settings.mapName||''}/></div>
  <footer><button type="button" onClick={onClose}>{t('Close')}</button></footer>
 </section></div>;
 return <div className="modal-backdrop" onMouseDown={onClose}><section className="map-doctor" role="dialog" aria-modal="true" aria-label={t('Map Doctor')} onMouseDown={e=>e.stopPropagation()}>
  <header><ShieldCheck size={22}/><strong>{t('Map Doctor')} · Svengine</strong><button title={t('Close')} onClick={onClose}><X size={18}/></button></header>
  <p>{t('Map Doctor checks editable geometry and summarizes real compiler errors. A pointfile from SC-BSP reveals the diagnosed leak route; static checks alone cannot prove a map is sealed.')}</p>
  <div className="map-doctor-stats"><span>{report.brushes} {t('brushes')}</span><span>{report.entities} {t('entities')}</span><span>{report.faces} {t('Faces')}</span><span>{report.textures} {t('Texture')}</span></div>
  <nav className="doctor-mode-tabs" aria-label="Map Doctor sections"><button type="button" className={tab==='general'?'active':''} onClick={()=>setTab('general')}>{t('Map Doctor')}</button><button type="button" className={tab==='coop'?'active':''} onClick={()=>setTab('coop')}>Co-op Playtest</button><button type="button" className={tab==='player'?'active':''} onClick={()=>setTab('player')}>{t('Player size check')}</button><button type="button" className={tab==='optimize'?'active':''} onClick={()=>setTab('optimize')}>{t('Optimization')}</button><button type="button" className={tab==='reach'?'active':''} onClick={()=>setTab('reach')}>{t('Player route')}</button></nav>
  {tab==='reach'?<ReachPanel onClose={onClose}/>:tab==='optimize'?<OptimizationPanel onClose={onClose}/>:tab==='player'?<section className="doctor-trace-panel"><div className="doctor-trace-heading"><strong>{t('Player size check')}</strong><small>{t('Whole map')}</small></div>
    <p>{t('Scans every floor of the map and marks passages narrower than the player, crouch-only spaces and ledges that need a jump or cannot be climbed. The marks stay in the 3D view while you fix them.')}</p>
    <div className="doctor-actions"><button type="button" onClick={()=>{openMapTool('player');onClose();}}><Search size={14}/> {t('Scan the map')}</button></div>
    <small>{t('Co-op Playtest checks the space around the spawns; this check covers the whole map.')}</small></section>
  :tab==='coop'?<CoopPlaytestPanel onClose={onClose}/>:<>
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
   {!filtered.length&&<p>{t('No findings for this filter.')}</p>}</div></>}
  <footer>{tab==='general'&&<button onClick={()=>editor.appendLogs([`Map Doctor: ${count('error')} errors, ${count('warning')} warnings, ${count('info')} notices.`,...buildFindings.map(f=>`[${f.code}] ${renderDoctorMessage(t(f.messageKey),f.params)}`)])}>{t('Write summary to build log')}</button>}<button onClick={onClose}>{t('Close')}</button></footer>
 </section></div>;
}
/** v2.6 Optimisation assistant (TWHL: Total Map Optimisation, Hint Brushes, zhlt_usemodel). */
function OptimizationPanel({onClose}:{onClose:()=>void}){
 const t=useT(),project=useEditor(s=>s.project);
 const [message,setMessage]=useState('');
 const report=useMemo(()=>analyzeOptimization(project),[project]);
 const select=(ids:string[])=>{useEditor.setState({selected:ids[ids.length-1]??null,selectedIds:ids,selectedFace:null});useEditor.getState().issueCameraCommand('frame');onClose();};
 const toDetail=(ids:string[])=>{try{const s=useEditor.getState();const r=convertToDetail(s.project.objects,ids);s.applyObjectList(r.objects,[r.entityId]);setMessage(`${r.count} ${t('brushes moved to func_detail. Compile and check for leaks; Ctrl+Z undoes it.')}`);}catch(e){setMessage(t(e instanceof Error?e.message:String(e)));}};
 const st=report.stats;
 return <section className="doctor-trace-panel doctor-optimize">
  <div className="doctor-trace-heading"><strong>{t('Optimization assistant')}</strong><small>{t('Static estimate')} · {report.score}/100</small></div>
  <p>{t('Suggestions from the TWHL optimisation guides. Real wpoly and clipnode counts come from the compiler and r_speeds in game.')}</p>
  <div className="map-doctor-stats"><span>{st.worldBrushes} {t('world brushes')}</span><span>{st.detailBrushes} func_detail</span><span>~{st.worldFaces} {t('world faces')}</span><span>{st.entities} {t('entities')}</span><span>{st.textures} {t('Texture')}</span><span>{st.span}u</span></div>
  <div className="map-doctor-issues">{report.findings.map(f=><div key={f.id} className={`map-doctor-issue ${f.level==='warning'?'warning':'info'} doctor-opt-row`}>
   {f.level==='warning'?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}<span><strong>{t(f.title)}{f.ids.length?` (${f.ids.length})`:''}</strong><small>{t(f.detail).replace('{n}',String(f.n??''))}</small>
   {f.ids.length>0&&<span className="doctor-actions">{f.action==='detail'&&<button type="button" onClick={()=>toDetail(f.ids)}>{t('Convert to func_detail')}</button>}<button type="button" onClick={()=>select(f.ids)}><Focus size={13}/> {t('Select in 3D')}</button></span>}</span></div>)}
   {!report.findings.length&&<p className="doctor-good"><CheckCircle2 size={15}/> {t('No optimisation problems found by the static check.')}</p>}</div>
  {message&&<small role="status">{message}</small>}
 </section>;
}
/** v2.6 Player route: what the players can reach from the spawns (doors closed / opened). */
function ReachPanel({onClose}:{onClose:()=>void}){
 const t=useT();const [report,setReport]=useState<ReachReport|null|undefined>(undefined);const [busy,setBusy]=useState(false);
 const run=()=>{setBusy(true);setTimeout(()=>{try{setReport(analyzeReachability(useEditor.getState().project));}finally{setBusy(false);}},20);};
 const pick=(id:string)=>{useEditor.setState({selected:id,selectedIds:[id],selectedFace:null});useEditor.getState().issueCameraCommand('frame');onClose();};
 const groups:[string,string][]=[['unreachable','Unreachable'],['behind-door','Only after opening doors'],['reachable','Reachable on foot']];
 return <section className="doctor-trace-panel doctor-optimize">
  <div className="doctor-trace-heading"><strong>{t('Player route')}</strong><small>{t('From the spawn points, walking, jumping and crouch-jumping')}</small></div>
  <p>{t('Finds items, weapons, keys, buttons and level changes the players cannot reach, or only after opening doors. Grid estimate; test in game to confirm.')}</p>
  <div className="doctor-actions"><button type="button" disabled={busy} onClick={run}><Search size={14}/> {busy?t('Analysing…'):t('Analyse the route')}</button></div>
  {report===null&&<p className="bsp-note">{t('The map needs brushes and at least one info_player_start / info_player_deathmatch.')}</p>}
  {report&&<>{report.keyProblems.map((k,i)=><div key={i} className="map-doctor-issue error"><AlertTriangle size={16}/><span><strong>{t('Key behind its own door')}</strong><small>{k}</small></span></div>)}
   {groups.map(([state,label])=>{const list=report.targets.filter(x=>x.state===state);if(!list.length)return null;
    return <div key={state} className="reach-group"><strong className={`reach-${state}`}>{t(label)} ({list.length})</strong>
     <div className="map-doctor-issues">{list.slice(0,80).map(x=><button key={x.id} type="button" className={`map-doctor-issue ${state==='unreachable'?'error':state==='behind-door'?'warning':'info'}`} onClick={()=>pick(x.id)}><Focus size={14}/><span><strong>{x.name}</strong><small>{x.classname}</small></span></button>)}</div></div>;})}
   {!report.targets.length&&<p className="doctor-good"><CheckCircle2 size={15}/> {t('No items, keys or buttons to check.')}</p>}</>}
 </section>;
}