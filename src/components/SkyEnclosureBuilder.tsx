import {useMemo,useState} from 'react';
import {CloudSun,BoxSelect,RefreshCw,CheckCircle2,AlertTriangle} from 'lucide-react';
import {useEditor} from '../store';
import {createSkyEnclosure,DEFAULT_SKY_ENCLOSURE,isAutoSkyEnclosure,type SkyEnclosureOptions} from '../engine/skyEnclosure';
import {useT} from '../i18n';

/** Geometry-only generator: six SKY world brushes, never a solid filled cube. */
export function SkyEnclosureBuilder(){
  const t=useT();
  const objects=useEditor(s=>s.project.objects);
  const generate=useEditor(s=>s.generateSkyEnclosure);
  const [options,setOptions]=useState<SkyEnclosureOptions>({...DEFAULT_SKY_ENCLOSURE});
  const [notice,setNotice]=useState('');
  const existing=useMemo(()=>objects.filter(isAutoSkyEnclosure).length,[objects]);
  const plan=useMemo(()=>{
    try{return {result:createSkyEnclosure(objects,options),error:''};}
    catch(e){return {result:null,error:e instanceof Error?e.message:String(e)};}
  },[objects,options]);
  const setNumeric=(key:'margin'|'thickness'|'grid',value:number)=>setOptions(o=>({...o,[key]:value}));
  const create=()=>{
    try{generate(options);setNotice(t('Sky enclosure generated. The interior is empty; the six SKY brushes are exported even when hidden in the editor.'));}
    catch(e){setNotice(`${t('Sky enclosure could not be generated')}: ${e instanceof Error?e.message:String(e)}`);}
  };
  return <section className="sky-enclosure-builder" aria-label={t('Create Sky Enclosure')}>
    <h3><BoxSelect size={17}/>{t('Create Sky Enclosure')}</h3>
    <p className="lighting-hint">{t('Generate six separate SKY-textured world brushes around the current map. The interior stays empty; keep the windows and roof openings you built.')}</p>
    <div className="sky-enclosure-fields">
      <label className="lighting-field">{t('Sky margin (units)')}
        <input type="number" min="32" max="4096" step="16" value={options.margin} onChange={e=>setNumeric('margin',Number(e.target.value))}/>
      </label>
      <label className="lighting-field">{t('Sky wall thickness (units)')}
        <input type="number" min="8" max="256" step="8" value={options.thickness} onChange={e=>setNumeric('thickness',Number(e.target.value))}/>
      </label>
      <label className="lighting-field">{t('Sky grid (units)')}
        <select value={options.grid} onChange={e=>setNumeric('grid',Number(e.target.value))}>
          {[1,4,8,16,32,64,128].map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
    <label className="lighting-check"><input type="checkbox" checked={options.hideInEditor} onChange={e=>setOptions(o=>({...o,hideInEditor:e.target.checked}))}/>{t('Hide enclosure in editor (still compiles)')}</label>
    {plan.error?<p className="sky-enclosure-warning"><AlertTriangle size={15}/>{t('Check sky enclosure settings')}: {plan.error}</p>:<p className="sky-enclosure-preview"><CheckCircle2 size={15}/>{t('Six SKY brushes will surround the map without filling the interior.')}</p>}
    {existing>0&&<p className="lighting-hint">{t('Existing auto sky brushes will be replaced')}: {existing}</p>}
    <div className="lighting-actions">
      <button className="lighting-primary" disabled={!plan.result} onClick={create}>
        {existing?<RefreshCw size={16}/>:<CloudSun size={16}/>}{t(existing?'Regenerate Sky Enclosure':'Create Sky Enclosure')}
      </button>
    </div>
    {notice&&<p role="status" className="lighting-notice">{notice}</p>}
    <p className="lighting-hint">{t('SKY must form a sealed outer shell. This tool does not fix leaks inside your own geometry or simulate light_environment; compile to verify.')}</p>
  </section>;
}
