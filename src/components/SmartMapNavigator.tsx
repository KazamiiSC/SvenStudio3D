import {useMemo,useState} from 'react';
import {Box,ChevronDown,ChevronRight,Focus,Search,UserRound} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {buildNavigatorIndex,findNavigatorEntries,type NavigatorKind} from '../engine/mapNavigator';
/** HF19: an extension of the existing Scene Explorer, never a second scene tree. */
export function SmartMapNavigator(){
 const t=useT();
 const objects=useEditor(s=>s.project.objects);
 const selected=useEditor(s=>s.selected);
 const focus=useEditor(s=>s.focusNavigatorObject);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[kind,setKind]=useState<NavigatorKind>('all');
 const index=useMemo(()=>open?buildNavigatorIndex(objects):[],[objects,open]);
 const selectedEntry=useMemo(()=>index.find(entry=>entry.id===selected),[index,selected]);
 const results=useMemo(()=>query.trim()?findNavigatorEntries(index,query,kind):{items:[],count:0},[index,query,kind]);
 return <section className="smart-map-navigator" aria-label={t('Smart Map Navigator')}>
   <button type="button" className="smart-map-navigator-heading" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
     {open?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<Focus size={15}/><strong>{t('Smart Map Navigator')}</strong>
   </button>
   {open&&<div className="smart-map-navigator-content">
     <button type="button" className="smart-map-focus-selection" disabled={!selectedEntry||selectedEntry.hidden}
       title={selectedEntry?.hidden?t('Show hidden object before focusing'):t('Center camera and highlight selected object')}
       onClick={()=>selectedEntry&&focus(selectedEntry.id)}><Focus size={14}/>{t('Focus selection in 3D')}</button>
     <label className="smart-map-navigator-search"><Search size={14}/>
       <input aria-label={t('Search map objects')} value={query} placeholder={t('Search name, class, texture, target...')} onChange={e=>setQuery(e.target.value)} />
     </label>
     <div className="smart-map-navigator-filters" aria-label={t('Object type filter')}>
       {(['all','brush','entity'] as const).map(value=><button key={value} type="button" className={kind===value?'active':''}
         aria-pressed={kind===value} onClick={()=>setKind(value)}>{t(value==='all'?'All':value==='brush'?'Brushes':'Entities')}</button>)}
     </div>
     {query.trim()?<>
       <div className="smart-map-navigator-count">{results.count} {t('results')}{results.count>results.items.length?` · ${t('Showing first')} ${results.items.length}`:''}</div>
       <div className="smart-map-navigator-results">
         {results.items.map(entry=><button type="button" key={entry.id} className={`smart-map-navigator-result ${selected===entry.id?'selected':''}`}
           onClick={()=>focus(entry.id)} disabled={entry.hidden} title={entry.hidden?t('Show hidden object before focusing'):t('Center camera and highlight selected object')}>
           {entry.kind==='brush'?<Box size={14}/>:<UserRound size={14}/>}
           <span><strong>{entry.name}</strong><small>{entry.subtitle}{entry.hidden?` · ${t('Hidden')}`:''}</small></span><Focus size={14}/>
         </button>)}
         {!results.items.length&&<p>{t('No matching map objects')}</p>}
       </div>
     </>:<p className="smart-map-navigator-hint">{t('Select any object, or search and click a result to frame it in 3D.')}</p>}
   </div>}
 </section>;
}
