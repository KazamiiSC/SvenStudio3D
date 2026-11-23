/** v2.4 player-size check panel, opened from Map Doctor (tab "Player size"). Non-modal so the map stays usable. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {X,PersonStanding,Eye,EyeOff,RefreshCw} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {analyzePlayerClearance,type ClearanceKind} from '../engine/mapTools24';
import {usePlayerCheck,CLEARANCE_COLORS,CLEARANCE_LABELS} from '../playerCheckState';

export type MapToolKind='player';
export function openMapTool(kind:MapToolKind){document.dispatchEvent(new CustomEvent('svenstudio:map-tool',{detail:{kind}}));}

/** Non-modal: the map stays usable while the marks are shown. */
function PlayerCheckPanel({onClose}:{onClose:()=>void}){
  const t=useT();
  const report=usePlayerCheck(s=>s.report),visible=usePlayerCheck(s=>s.visible),focus=usePlayerCheck(s=>s.focus);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const scan=()=>{setBusy(true);setError('');window.setTimeout(()=>{try{usePlayerCheck.getState().setReport(analyzePlayerClearance(useEditor.getState().project));}catch(e){setError(String(e instanceof Error?e.message:e));}setBusy(false);},30);};
  useEffect(()=>{if(!usePlayerCheck.getState().report)scan();},[]);
  // v2.4: re-scan by itself a moment after the map changes (can be turned off).
  const [auto,setAuto]=useState(true);
  const objects=useEditor(s=>s.project.objects);
  const first=useRef(true);
  useEffect(()=>{
    if(first.current){first.current=false;return;}
    if(!auto)return;
    const timer=window.setTimeout(()=>{try{usePlayerCheck.getState().setReport(analyzePlayerClearance(useEditor.getState().project));}catch{/* keep last result */}},1200);
    return()=>window.clearTimeout(timer);
  },[objects,auto]);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!(e.target instanceof HTMLInputElement)){close2();}};const close2=()=>{usePlayerCheck.getState().setReport(null);onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);
  const counts=useMemo(()=>{const c:Record<string,number>={};for(const i of report?.issues??[])c[i.kind]=(c[i.kind]??0)+1;return c;},[report]);
  const issues=(report?.issues??[]).filter(i=>visible[i.kind]);
  const close=()=>{usePlayerCheck.getState().setReport(null);onClose();};
  return <aside className="player-check-panel" aria-label={t('Player size check')}>
    <header><PersonStanding size={17}/><strong>{t('Player size check')}</strong>
      <button type="button" title={t('Scan again')} aria-label={t('Scan again')} onClick={scan} disabled={busy}><RefreshCw size={15} className={busy?'spin':''}/></button>
      <button type="button" aria-label={t('Close')} onClick={close}><X size={16}/></button></header>
    <p>{t('Standing player 32×32×72u, crouched 36u, step 18u. Approximate grid scan: confirm in game.')}</p>
    <label className="player-check-auto"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>{t('Scan again automatically after each change')}</label>
    {busy&&<div className="player-check-busy">{t('Scanning the map…')}</div>}
    {error&&<div className="map-tool-notice">{error}</div>}
    {report&&!busy&&<>
      <div className="player-check-legend">{(Object.keys(CLEARANCE_LABELS) as ClearanceKind[]).map(kind=><button type="button" key={kind} className={visible[kind]?'':'is-off'} onClick={()=>usePlayerCheck.getState().toggle(kind)}>
        <i style={{background:CLEARANCE_COLORS[kind]}}/>{t(CLEARANCE_LABELS[kind])}<b>{counts[kind]??0}</b>{visible[kind]?<Eye size={13}/>:<EyeOff size={13}/>}</button>)}</div>
      <small className="player-check-meta">{`${t('Grid')}: ${report.step}u · ${report.floors} ${t('floor samples')}`}{report.truncated?` · ${t('large map: coarse scan')}`:''}</small>
      {!report.issues.length?<div className="player-check-ok">{t('No problems found for the player size.')}</div>:
      <ol className="player-check-list">{issues.slice(0,120).map(issue=>{const index=report.issues.indexOf(issue);return <li key={index}><button type="button" className={focus===index?'is-focus':''} onClick={()=>{usePlayerCheck.getState().setFocus(index);useEditor.getState().frameBox([issue.min[0]-96,issue.min[1]-96,issue.min[2]],[issue.max[0]+96,issue.max[1]+96,issue.max[2]+32]);}}>
        <i style={{background:CLEARANCE_COLORS[issue.kind]}}/><span>{t(CLEARANCE_LABELS[issue.kind])}</span><small>{issue.center.map(Math.round).join(' ')}</small></button></li>;})}</ol>}
    </>}
  </aside>;
}

export function MapToolsHost(){
  const [kind,setKind]=useState<MapToolKind|null>(null);
  useEffect(()=>{const open=(e:Event)=>setKind((e as CustomEvent<{kind:MapToolKind}>).detail.kind);document.addEventListener('svenstudio:map-tool',open);return()=>document.removeEventListener('svenstudio:map-tool',open);},[]);
  const close=()=>setKind(null);
  if(kind==='player')return <PlayerCheckPanel onClose={close}/>;
  return null;
}
