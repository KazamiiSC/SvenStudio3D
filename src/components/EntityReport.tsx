/** Entity report: every entity in one table, with broken references, bulk keyvalue edits and a
 * targetname rename that updates all references. Each change is one Undo step. */
import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {ListTree,X,Focus,AlertTriangle,PencilLine,Tags} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import type {PointEntity} from '../engine/types';
import {buildEntityReport,entityMatches,planTargetnameRename} from '../engine/entityReport';

const MAX_ROWS=600;

export function EntityReport({onClose}:{onClose:()=>void}){
  const t=useT();
  const objects=useEditor(s=>s.project.objects);
  const renameTargetname=useEditor(s=>s.renameTargetname);
  const setEntityKeyvalues=useEditor(s=>s.setEntityKeyvalues);
  const [query,setQuery]=useState('');
  const [classFilter,setClassFilter]=useState('all');
  const [onlyProblems,setOnlyProblems]=useState(false);
  const [checked,setChecked]=useState<string[]>([]);
  const [bulkKey,setBulkKey]=useState('');const [bulkValue,setBulkValue]=useState('');
  const [renameFrom,setRenameFrom]=useState('');const [renameTo,setRenameTo]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose();}};window.addEventListener('keydown',close,true);return()=>window.removeEventListener('keydown',close,true);},[onClose]);

  const entities=useMemo(()=>new Map(objects.filter((o):o is PointEntity=>o.kind==='entity').map(e=>[e.id,e])),[objects]);
  const report=useMemo(()=>buildEntityReport(objects),[objects]);
  const classes=useMemo(()=>{const m=new Map<string,number>();for(const r of report)m.set(r.classname,(m.get(r.classname)??0)+1);return [...m].sort((a,b)=>a[0].localeCompare(b[0]));},[report]);
  const targetnames=useMemo(()=>[...new Set(report.map(r=>r.targetname).filter(Boolean))].sort(),[report]);
  const problems=report.filter(r=>r.brokenRefs.length).length;
  const rows=useMemo(()=>report.filter(r=>(classFilter==='all'||r.classname===classFilter)&&(!onlyProblems||r.brokenRefs.length>0)&&entityMatches(entities.get(r.id)!,query)),[report,classFilter,onlyProblems,query,entities]);
  const visible=rows.slice(0,MAX_ROWS);
  const checkedSet=new Set(checked);
  const allVisibleChecked=visible.length>0&&visible.every(r=>checkedSet.has(r.id));
  const toggleAll=()=>setChecked(allVisibleChecked?checked.filter(id=>!visible.some(r=>r.id===id)):[...new Set([...checked,...visible.map(r=>r.id)])]);
  const focus=(id:string)=>{const s=useEditor.getState();s.selectObjectIds([id]);s.issueCameraCommand('frame');};

  const renamePreview=useMemo(()=>{
    if(!renameFrom.trim()||!renameTo.trim())return null;
    try{return planTargetnameRename(objects,renameFrom,renameTo);}catch(error){return {error:String(error instanceof Error?error.message:error)};}
  },[objects,renameFrom,renameTo]);

  const applyBulk=()=>{
    try{const n=setEntityKeyvalues(checked,bulkKey,bulkValue);setNotice(n?`${t('Updated entities')}: ${n}. ${t('Ctrl+Z undoes it in one step.')}`:t('Nothing changed.'));}
    catch(error){setNotice(t(String(error instanceof Error?error.message:error)));}
  };
  const applyRename=()=>{
    try{const p=renameTargetname(renameFrom,renameTo);setNotice(`${t('Renamed')}: ${p.renamedEntities} · ${t('references updated')}: ${p.updatedReferences}. ${t('Ctrl+Z undoes it in one step.')}`);setRenameFrom(renameTo.trim());setRenameTo('');}
    catch(error){setNotice(t(String(error instanceof Error?error.message:error)));}
  };

  return createPortal(<div className="modal-backdrop entity-report-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="modal-card entity-report" role="dialog" aria-modal="true" aria-labelledby="entity-report-title">
      <div className="modal-title"><ListTree size={18}/><span id="entity-report-title">{t('Entity report')}</span><small className="entity-report-count">{report.length} · {problems?<span className="entity-report-bad">{problems} {t('with broken references')}</span>:t('no broken references')}</small><button type="button" aria-label={t('Close')} onClick={onClose}><X size={18}/></button></div>
      <div className="entity-report-toolbar">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Search classname, targetname or any keyvalue…')} spellCheck={false} autoFocus/>
        <select value={classFilter} onChange={e=>setClassFilter(e.target.value)} aria-label="classname"><option value="all">{t('All classnames')}</option>{classes.map(([name,count])=><option key={name} value={name}>{`${name} (${count})`}</option>)}</select>
        <label className="entity-report-check"><input type="checkbox" checked={onlyProblems} onChange={e=>setOnlyProblems(e.target.checked)}/>{t('Only problems')}</label>
      </div>
      <div className="entity-report-table" role="region" aria-label={t('Entity report')}>
        <table>
          <thead><tr><th><input type="checkbox" aria-label={t('Select all')} checked={allVisibleChecked} onChange={toggleAll}/></th><th>classname</th><th>targetname</th><th>target</th><th title={t('Entities that point at this targetname')}>{t('In')}</th><th>{t('Brushes')}</th><th>{t('Problems')}</th><th/></tr></thead>
          <tbody>{visible.map(r=><tr key={r.id} className={r.brokenRefs.length?'has-problem':''} onDoubleClick={()=>focus(r.id)}>
            <td><input type="checkbox" aria-label={r.classname} checked={checkedSet.has(r.id)} onChange={()=>setChecked(checkedSet.has(r.id)?checked.filter(id=>id!==r.id):[...checked,r.id])}/></td>
            <td>{r.classname}{r.locked?' 🔒':''}{r.hidden?` · ${t('hidden')}`:''}</td>
            <td><button type="button" className="entity-report-link" disabled={!r.targetname} onClick={()=>{setRenameFrom(r.targetname);setRenameTo('');}} title={t('Rename this targetname')}>{r.targetname||'—'}</button></td>
            <td>{r.target||'—'}</td><td>{r.targetname?r.incoming:'—'}</td><td>{r.brushCount||'—'}</td>
            <td className="entity-report-problems">{r.brokenRefs.length?<><AlertTriangle size={13}/>{r.brokenRefs.join(', ')}</>:''}</td>
            <td><button type="button" className="entity-report-focus" title={t('Select and frame in the 3D view')} aria-label={t('Select and frame in the 3D view')} onClick={()=>focus(r.id)}><Focus size={14}/></button></td>
          </tr>)}</tbody>
        </table>
        {rows.length>MAX_ROWS&&<p className="entity-report-more">{t('Showing the first')} {MAX_ROWS} / {rows.length}. {t('Use the search or classname filter to narrow it down.')}</p>}
        {!rows.length&&<p className="entity-report-more">{t('No entity matches.')}</p>}
      </div>
      <div className="entity-report-actions">
        <fieldset><legend><Tags size={14}/>{t('Edit keyvalue on checked entities')} ({checked.length})</legend>
          <div className="entity-report-row"><input value={bulkKey} onChange={e=>setBulkKey(e.target.value)} placeholder="key" spellCheck={false}/><input value={bulkValue} onChange={e=>setBulkValue(e.target.value)} placeholder={t('value (empty removes the key)')} spellCheck={false}/>
          <button type="button" disabled={!checked.length||!bulkKey.trim()} onClick={applyBulk}>{t('Apply')}</button></div>
        </fieldset>
        <fieldset><legend><PencilLine size={14}/>{t('Rename targetname everywhere')}</legend>
          <div className="entity-report-row"><input list="entity-report-names" value={renameFrom} onChange={e=>setRenameFrom(e.target.value)} placeholder={t('current name')} spellCheck={false}/><datalist id="entity-report-names">{targetnames.map(n=><option key={n} value={n}/>)}</datalist>
          <input value={renameTo} onChange={e=>setRenameTo(e.target.value)} placeholder={t('new name')} spellCheck={false}/>
          <button type="button" disabled={!renamePreview||'error' in renamePreview||!(renamePreview.renamedEntities||renamePreview.updatedReferences)} onClick={applyRename}>{t('Rename')}</button></div>
          {renamePreview&&<small className={'error' in renamePreview?'entity-report-bad':''}>{'error' in renamePreview?t(renamePreview.error):
            `${renamePreview.renamedEntities} ${t('entities renamed')} · ${renamePreview.updatedReferences} ${t('references updated')}${renamePreview.skippedWildcards?` · ${renamePreview.skippedWildcards} ${t('wildcard references (*) left as they are')}`:''}${renamePreview.skippedLocked?` · ${renamePreview.skippedLocked} ${t('locked entities skipped')}`:''}`}</small>}
        </fieldset>
      </div>
      {notice&&<p className="entity-report-notice" aria-live="polite">{notice}</p>}
    </section>
  </div>,document.body);
}
