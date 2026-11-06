import {useMemo,useState} from 'react';
import {Eye,EyeOff,Focus,Search,Layers,Undo2} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';

export function VisibilityManager({onClose}:{onClose:()=>void}){
  const t=useT();
  const objects=useEditor(s=>s.project.objects),toggle=useEditor(s=>s.toggleVisibility);
  const tracked=useEditor(s=>s.visibilityListIds),focusHidden=useEditor(s=>s.focusHidden);
  const reveal=useEditor(s=>s.revealAll),ghost=useEditor(s=>s.ghostHidden),toggleGhost=useEditor(s=>s.toggleGhostHidden);
  const isolation=useEditor(s=>s.isolationSnapshot),toggleIsolation=useEditor(s=>s.toggleTemporaryIsolation);
  const undo=useEditor(s=>s.undo);
  const [query,setQuery]=useState(''),[limit,setLimit]=useState(100);
  const hidden=useMemo(()=>objects.filter(o=>o.hidden||tracked.includes(o.id)).filter(o=>!query||`${o.id} ${o.name} ${o.kind} ${o.position.join(' ')}`.toLowerCase().includes(query.toLowerCase())),[objects,tracked,query]);
  const allHidden=objects.filter(o=>o.hidden).length;
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal-card visibility-manager" role="dialog" aria-modal="true" aria-label={t('Visibility manager')} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-title"><Eye size={19}/><span>{t('Visibility manager')} · {allHidden} {t('Hidden objects')}</span><button onClick={onClose} aria-label={t('Close')}>×</button></div>
      <p className="modal-subtext">{t('Hidden and previously hidden objects remain listed. Focus shows hidden brushes as ghosts without unhiding them.')}</p>
      <div className="visibility-actions">
        <button onClick={reveal}><Eye size={15}/>{t('Show all')} (Alt+H)</button>
        <button className={ghost?'active':''} onClick={toggleGhost}><EyeOff size={15}/>{t('Ghost mode')}: {ghost?t('On'):t('Off')}</button>
        <button onClick={toggleIsolation} disabled={!isolation&&!useEditor.getState().selectedIds.length}><Layers size={15}/>{isolation?t('Exit isolation'):t('Isolate selection')}</button>
        <button onClick={undo}><Undo2 size={15}/>{t('Undo')}</button>
      </div>
      <label className="visibility-search"><Search size={15}/><input value={query} onChange={e=>{setQuery(e.target.value);setLimit(100)}} placeholder={t('Search ID, name or coordinates...')}/></label>
      <div className="visibility-items">
        {hidden.slice(0,limit).map(o=><div className="visibility-item" key={o.id}>
          <div><strong>{o.kind==='brush'?'Brush':'Entity'} #{o.id.slice(0,8)}</strong><small>{o.name||o.kind} · X:{Math.round(o.position[0])} Y:{Math.round(o.position[1])} Z:{Math.round(o.position[2])}</small></div>
          <button title={t(o.hidden?'Show':'Hide')} onClick={()=>toggle(o.id)}>{o.hidden?<Eye size={16}/>:<EyeOff size={16}/>}</button>
          <button title={t('Show and focus')} onClick={()=>{focusHidden(o.id);onClose()}}><Focus size={16}/></button>
        </div>)}
        {!hidden.length&&<p className="visibility-empty">{t('No hidden objects')}</p>}
        {hidden.length>limit&&<button className="visibility-more" onClick={()=>setLimit(v=>v+100)}>{t('Load more')} ({hidden.length-limit})</button>}
      </div>
      <div className="modal-footer"><button className="primary-action" onClick={onClose}>{t('Close')}</button></div>
    </section>
  </div>;
}
