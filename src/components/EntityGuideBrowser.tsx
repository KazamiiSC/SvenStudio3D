/** v2.6 Help → Entity guide: a searchable encyclopedia of every Sven Co-op entity with
 * how-to steps, ideas, wiring examples, tips, key keyvalues and the loaded FGD reference. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,Search,X,Lightbulb,ListChecks,Workflow,AlertTriangle,KeyRound,Link2,MousePointer2,FileCode2,GraduationCap} from 'lucide-react';
import {useEditor} from '../store';
import {translate} from '../i18n';
import {ENCYCLOPEDIA_CLASSES,GUIDE_BASICS,GUIDE_CATEGORIES,encyclopediaEntry,relatedTo,searchEncyclopedia,type GuideCategory} from '../engine/entityEncyclopedia';

const BASICS='__basics__';
const POINT_CATS:GuideCategory[]=['logic','effects','audio','lighting','game','player','info','path','item','weapon','ammo','npc','ally','corpse','xen','compile','script'];

export function EntityGuideBrowser({initialClass,onPlace}:{initialClass?:string;onPlace?:()=>void}){
  const locale=useEditor(s=>s.locale);
  const fgdClasses=useEditor(s=>s.fgdClasses);
  const tr=(k:string)=>translate(locale,k);
  const es=locale==='es';
  const [query,setQuery]=useState('');
  const [cat,setCat]=useState<GuideCategory|''>('');
  const [chosen,setChosen]=useState<string>(()=>initialClass&&encyclopediaEntry(initialClass)?ENCYCLOPEDIA_CLASSES.find(c=>c.toLowerCase()===initialClass.toLowerCase())!:BASICS);
  const detailRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{detailRef.current?.scrollTo({top:0});},[chosen]);
  const results=useMemo(()=>searchEncyclopedia(query,cat),[query,cat]);
  const grouped=useMemo(()=>GUIDE_CATEGORIES.map(g=>({g,items:results.filter(c=>encyclopediaEntry(c)!.cat===g.id)})).filter(x=>x.items.length),[results]);
  const counts=useMemo(()=>Object.fromEntries(GUIDE_CATEGORIES.map(g=>[g.id,ENCYCLOPEDIA_CLASSES.filter(c=>encyclopediaEntry(c)!.cat===g.id).length])),[]);
  const catLabel=(id:GuideCategory)=>{const g=GUIDE_CATEGORIES.find(x=>x.id===id)!;return es?g.es:g.en;};
  const entry=chosen===BASICS?undefined:encyclopediaEntry(chosen);
  const fgd=entry?fgdClasses.find(c=>c.name.toLowerCase()===chosen.toLowerCase()):undefined;
  const usedWith=entry?relatedTo(chosen):[];
  const go=(name:string)=>{const real=ENCYCLOPEDIA_CLASSES.find(c=>c.toLowerCase()===name.toLowerCase());if(real){setChosen(real);}};
  const place=()=>{useEditor.getState().startNpcPlacement(chosen);onPlace?.();};
  const canPlace=!!entry&&POINT_CATS.includes(entry.cat)&&(!fgd||fgd.type==='point')&&chosen!=='worldspawn';
  const flagProps=fgd?Object.entries(fgd.props).filter(([,p])=>p.type==='flags'):[];
  const valueProps=fgd?Object.entries(fgd.props).filter(([,p])=>p.type!=='flags'):[];
  return <div className="eg-root">
    <aside className="eg-side">
      <label className="eg-search"><Search size={15}/><input autoFocus placeholder={tr('Search entities, effects or ideas…')} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label={tr('Clear')} onClick={()=>setQuery('')}><X size={13}/></button>}</label>
      <select className="eg-cat" value={cat} onChange={e=>setCat(e.target.value as GuideCategory|'')} aria-label={tr('Category')}>
        <option value="">{tr('All categories')} ({ENCYCLOPEDIA_CLASSES.length})</option>
        {GUIDE_CATEGORIES.map(g=><option key={g.id} value={g.id}>{catLabel(g.id)} ({counts[g.id]})</option>)}
      </select>
      <div className="eg-list">
        {!query&&!cat&&<button type="button" className={`eg-item eg-basics${chosen===BASICS?' active':''}`} onClick={()=>setChosen(BASICS)}><GraduationCap size={15}/><span><strong>{tr('Mapping basics')}</strong><small>target · targetname · master · delay</small></span></button>}
        {grouped.map(({g,items})=><div key={g.id} className="eg-group"><h4>{catLabel(g.id)}<span>{items.length}</span></h4>
          {items.map(c=>{const e=encyclopediaEntry(c)!;return <button type="button" key={c} className={`eg-item${chosen===c?' active':''}`} onClick={()=>setChosen(c)} title={es?e.s:e.en}><span><strong>{c}</strong><small>{es?e.s:e.en}</small></span></button>;})}
        </div>)}
        {!grouped.length&&<p className="eg-empty">{tr('No entity matches the search.')}</p>}
      </div>
    </aside>
    <div className="eg-detail" ref={detailRef}>
      {chosen===BASICS?<>
        <header className="eg-head"><GraduationCap size={26}/><div><h2>{tr('Mapping basics')}</h2><p>{tr('Read this first: how entities talk to each other in GoldSrc / Svengine.')}</p></div></header>
        {!es&&<p className="eg-lang-note">{tr('The detailed guide text is written in Spanish; summaries and keyvalue names are shown in your language when available.')}</p>}
        <div className="eg-basics-grid">{GUIDE_BASICS.map(b=><section key={b.title} className="eg-card"><h3>{es?b.title:`${b.en} · ${b.title}`}</h3><ul>{b.body.map((x,i)=><li key={i}>{x}</li>)}</ul></section>)}</div>
        <section className="eg-card eg-sources"><h3><BookOpen size={15}/>{tr('Sources')}</h3><p>{tr('Written from the Sven Co-op FGD, the official Sven Co-op entity documentation and the TWHL Half-Life mapping tutorials. Always test in game: the engine has the last word.')}</p></section>
      </>:entry&&<>
        <header className="eg-head">
          <div className="eg-title"><span className={`eg-badge eg-cat-${entry.cat}`}>{catLabel(entry.cat)}</span><h2>{chosen}</h2>{fgd?.description&&fgd.description!==chosen&&<small>{fgd.description}</small>}</div>
          {canPlace&&<button type="button" className="eg-place" onClick={place}><MousePointer2 size={15}/>{tr('Place in map')}</button>}
        </header>
        <p className="eg-summary">{es?entry.s:entry.en}</p>
        {!es&&<p className="eg-summary-alt">{entry.s}</p>}
        <div className="eg-sections">
          {entry.how&&<section className="eg-card"><h3><ListChecks size={16}/>{tr('How to use it')}</h3><ol>{entry.how.map((x,i)=><li key={i}>{x}</li>)}</ol></section>}
          {entry.ideas&&<section className="eg-card"><h3><Lightbulb size={16}/>{tr('What you can build')}</h3><ul>{entry.ideas.map((x,i)=><li key={i}>{x}</li>)}</ul></section>}
          {entry.ex&&<section className="eg-card eg-wide"><h3><Workflow size={16}/>{tr('Examples')}</h3><div className="eg-examples">{entry.ex.map(([title,recipe],i)=><div key={i} className="eg-example"><strong>{title}</strong><code>{recipe}</code></div>)}</div></section>}
          {entry.keys&&<section className="eg-card"><h3><KeyRound size={16}/>{tr('Key keyvalues')}</h3><dl className="eg-keys">{entry.keys.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>}
          {entry.tips&&<section className="eg-card eg-tips"><h3><AlertTriangle size={16}/>{tr('Tips and common mistakes')}</h3><ul>{entry.tips.map((x,i)=><li key={i}>{x}</li>)}</ul></section>}
          {(entry.rel?.length||usedWith.length)?<section className="eg-card eg-wide"><h3><Link2 size={16}/>{tr('Related entities')}</h3><div className="eg-chips">{[...new Set([...(entry.rel??[]),...usedWith])].map(r=><button type="button" key={r} onClick={()=>go(r)}>{r}</button>)}</div></section>:null}
          <section className="eg-card eg-wide eg-fgd"><h3><FileCode2 size={16}/>{tr('FGD reference')}</h3>
            {fgd?<>
              {valueProps.length>0&&<div className="eg-fgd-table" role="table">{valueProps.map(([k,p])=><div role="row" key={k}><code role="cell">{k}</code><span role="cell">{p.label}</span><small role="cell">{p.type}{p.defaultValue?` · ${p.defaultValue}`:''}{p.options?.length?` · ${p.options.slice(0,6).map(o=>`${o.value}=${o.label}`).join(', ')}${p.options.length>6?'…':''}`:''}</small></div>)}</div>}
              {flagProps.map(([k,p])=><div key={k} className="eg-flags"><strong>spawnflags</strong>{p.options?.map(o=><span key={o.value}><code>{o.value}</code>{o.label}</span>)}</div>)}
            </>:<p className="eg-muted">{tr('Load the Sven Co-op FGD (Entities panel) to see every keyvalue and spawnflag of this entity here.')}</p>}
          </section>
        </div>
      </>}
    </div>
  </div>;
}
