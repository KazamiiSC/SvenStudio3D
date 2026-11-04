import {useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,Search,ShieldCheck,X} from 'lucide-react';
import {useEditor} from '../store';
import {analyzeMap,type MapIssue} from '../engine/mapDiagnostics';
import {useT} from '../i18n';
export function MapDoctor({onClose}:{onClose:()=>void}){
 const t=useT(),editor=useEditor(),[severity,setSeverity]=useState<'all'|MapIssue['severity']>('all');
 const report=useMemo(()=>analyzeMap(editor.project,editor.textureAssets,editor.fgdClasses,editor.fgdLoaded),[editor.project,editor.textureAssets,editor.fgdClasses,editor.fgdLoaded]);
 const filtered=report.issues.filter(i=>severity==='all'||i.severity===severity);
 const localizeIssue=(issue:MapIssue)=>Object.entries(issue.params||{}).reduce((str,[key,value])=>str.replaceAll(`{${key}}`,String(value)),t(issue.template||issue.message));
 const count=(kind:MapIssue['severity'])=>report.issues.filter(i=>i.severity===kind).length;
 return <div className="modal-backdrop" onMouseDown={onClose}><section className="map-doctor" role="dialog" aria-modal="true" aria-label={t('Map Doctor')} onMouseDown={e=>e.stopPropagation()}>
  <header><ShieldCheck size={22}/><strong>{t('Map Doctor')} · Svengine</strong><button title={t('Close')} onClick={onClose}><X size={18}/></button></header>
  <p>{t('Static checks for convex brushes, entity targets and imported WAD previews. Only SC-CSG/SC-BSP can confirm leaks and final compilation.')}</p>
  <div className="map-doctor-stats"><span>{report.brushes} {t('brushes')}</span><span>{report.entities} {t('entities')}</span><span>{report.faces} {t('Faces')}</span><span>{report.textures} {t('Texture')}</span></div>
  <nav>{(['all','error','warning','info'] as const).map(kind=><button className={severity===kind?'active':''} key={kind} onClick={()=>setSeverity(kind)}>{t(kind==='all'?'All issues':kind==='error'?'Errors':kind==='warning'?'Warnings':'Information')} ({kind==='all'?report.issues.length:count(kind)})</button>)}</nav>
  <div className="map-doctor-issues">{filtered.map((issue,i)=><button key={`${issue.code}-${issue.objectId||i}`} onClick={()=>{if(issue.objectId){editor.setSelected(issue.objectId);onClose()}}} className={`map-doctor-issue ${issue.severity}`} disabled={!issue.objectId}>
    {issue.severity==='error'?<AlertTriangle size={16}/>:issue.severity==='warning'?<Search size={16}/>:<CheckCircle2 size={16}/>}<span><strong>{t(issue.category[0].toUpperCase()+issue.category.slice(1))} · {issue.code}</strong><small>{localizeIssue(issue)}</small></span></button>)}
   {!filtered.length&&<p>{t('No findings for this filter.')}</p>}</div>
  <footer><button onClick={()=>editor.appendLogs([`Map Doctor: ${count('error')} errors, ${count('warning')} warnings, ${count('info')} notices.`])}>{t('Write summary to build log')}</button><button onClick={onClose}>{t('Close')}</button></footer>
 </section></div>
}
