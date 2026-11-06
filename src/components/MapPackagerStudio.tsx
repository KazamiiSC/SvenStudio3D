import {useState} from 'react';
import {AlertTriangle,CheckCircle2,Download,FolderSearch,Package,RefreshCw,ShieldCheck,X} from 'lucide-react';
import {useT} from '../i18n';
import {useEditor} from '../store';
import {customNpcFiles} from '../engine/customNpc';

type PackageEntry={path:string;status:'ready'|'missing'|'builtin'|'oversize'|'conflict';layer:string;size:number;reason:string;required?:boolean};
type PackageScan={mapName:string;entries:PackageEntry[];warnings:string[];missing:number;ready:number;builtin:number;entities:number;externalTextures:boolean};

/** Not a map editor. This viewer only requests a read-only scan and downloads a new ZIP. */
export function MapPackagerStudio({onClose}:{onClose:()=>void}){
  const t=useT();
  const gameDir=useEditor(s=>s.settings.gameDir);
  const mapName=useEditor(s=>s.settings.mapName);
  const projectName=useEditor(s=>s.project.name);
  const [packageMapName,setPackageMapName]=useState(mapName);
  const customNpcs=useEditor(s=>s.project.customNpcs);
  const [manual,setManual]=useState('');
  const [addCustom,setAddCustom]=useState(true);
  const [scan,setScan]=useState<PackageScan|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [acknowledge,setAcknowledge]=useState(false);
  const [filter,setFilter]=useState<'all'|'ready'|'missing'|'builtin'>('all');
  const [npcInstructions,setNpcInstructions]=useState<string[]>([]);
  const makeInput=()=>{
    const inlineFiles:{path:string;content:string}[]=[];
    const scriptLines:string[]=[];
    if(addCustom){
      for(const npc of customNpcs||[]){
        const {files,mapScript}=customNpcFiles(npc,packageMapName);
        for(const f of files){
          if(!f.path.toLowerCase().startsWith('scripts/maps/'))continue;
          const content=new TextDecoder().decode(f.bytes);
          if(inlineFiles.some(x=>x.path.toLowerCase()===f.path.toLowerCase()&&x.content!==content))throw Error(`${t('Conflicting Custom NPC scripts')}: ${f.path}`);
          if(!inlineFiles.some(x=>x.path.toLowerCase()===f.path.toLowerCase()))inlineFiles.push({path:f.path,content});
        }
        scriptLines.push(`map_script ${mapScript}`);
      }
    }
    const manualPaths=manual.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
    if(addCustom)for(const npc of customNpcs||[])if(npc.modelPath&&!manualPaths.some(p=>p.toLowerCase()===npc.modelPath.toLowerCase()))manualPaths.push(npc.modelPath);
    return {gameDir,mapName:packageMapName,manualPaths,inlineFiles,scriptLines};
  };
  const request=async(url:string,body:unknown)=>{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok){const error=await response.json().catch(()=>({error:`HTTP ${response.status}`}));throw Error(error.error||`HTTP ${response.status}`)}
    return response;
  };
  const analyze=async()=>{
    setBusy(true);setScan(null);setAcknowledge(false);setMessage('');
    try{
      const input=makeInput();const res=await request('/api/packager/scan',input);const result:PackageScan=await res.json();
      setScan(result);setSelected(new Set(result.entries.filter(e=>e.status==='ready').map(e=>e.path.toLowerCase())));
      setNpcInstructions(input.scriptLines);setMessage(`${result.ready} ${t('ready resources')} · ${result.missing} ${t('missing resources')}`);
    }catch(error){setMessage(String(error instanceof Error?error.message:error))}finally{setBusy(false)}
  };
  const download=async()=>{
    if(!scan)return;setBusy(true);setMessage('');
    try{
      const input=makeInput();
      const response=await request('/api/packager/download',{...input,selectedPaths:[...selected],acknowledgeMissing:acknowledge});
      const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');
      link.href=url;link.download=`${packageMapName}_SvenCoop.zip`;document.body.append(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      setMessage(`${t('Package created')}: ${(blob.size/1048576).toFixed(1)} MB. ${t('Review ZIP before sharing')}`);
    }catch(error){setMessage(String(error instanceof Error?error.message:error))}finally{setBusy(false)}
  };
  const toggle=(path:string)=>setSelected(prev=>{const next=new Set(prev);const key=path.toLowerCase();if(next.has(key))next.delete(key);else next.add(key);return next});
  return <div className="modal-backdrop mp-backdrop" onMouseDown={onClose}>
    <section className="mp-shell" role="dialog" aria-modal="true" aria-label={t('Map Packager Studio')} onMouseDown={e=>e.stopPropagation()}>
      <header className="mp-header"><Package size={22}/><div><strong>{t('Map Packager Studio')}</strong><small>{t('Review local map dependencies · Sven Co-op / Svengine')}</small></div><button title={t('Close')} onClick={onClose}><X size={19}/></button></header>
      <div className="mp-body">
        <aside className="mp-left">
          <h3>{t('Package settings')}</h3>
          <label>{t('Compiled map')}<input spellCheck={false} value={packageMapName} onChange={e=>{setPackageMapName(e.target.value);setScan(null)}} aria-label="Compiled map name"/>.bsp</label>
          <p className="mp-muted" role="status">{t('Only a BSP already compiled in the game folder can be packaged. An opened MAP is not automatically a compiled BSP.')}</p>
          {projectName&&projectName.toLowerCase()!==packageMapName.toLowerCase()&&<div className="mp-warning" role="alert">{t('The loaded project and the selected compiled BSP have different names. Confirm this is the file you intend to share.')} ({projectName} / {packageMapName}.bsp)</div>}
          <label>{t('Game folder')}<input readOnly value={gameDir||t('Not configured')}/></label>
          <p className="mp-muted">{t('Uses the compiled BSP in your configured maps folder. Compile your latest changes before scanning.')}</p>
          <label className="mp-check"><input type="checkbox" checked={addCustom} onChange={e=>{setAddCustom(e.target.checked);setScan(null)}} disabled={!(customNpcs||[]).length}/>{t('Include registered Custom NPC scripts')} ({(customNpcs||[]).length})</label>
          <p className="mp-muted">{t('Scripts are packaged as source, never executed. Existing CFG files are not changed.')}</p>
          <label>{t('Additional game-relative paths (one per line)')}<textarea rows={8} spellCheck={false} value={manual} onChange={e=>{setManual(e.target.value);setScan(null)}} placeholder={'models/my_map/custom.mdl\nsound/my_map/ambient.wav\nsprites/my_map/glow.spr'}/></label>
          <button className="mp-action" disabled={busy||!gameDir} onClick={()=>void analyze()}><FolderSearch size={16}/>{busy?t('Working...'):t('Analyze resources')}</button>
          <p className="mp-muted">{t('Paths must be relative to the Sven Co-op game folder. No files are modified.')}</p>
        </aside>
        <main className="mp-center">
          <div className="mp-title"><h3>{t('Dependency Inspector')}</h3><span>{scan?`${scan.entries.length} ${t('resources')}`:''}</span></div>
          {scan?<>
            <div className="mp-stats"><div><strong>{scan.ready}</strong><span>{t('Ready')}</span></div><div><strong>{scan.missing}</strong><span>{t('Missing')}</span></div><div><strong>{scan.builtin}</strong><span>{t('Game built-in')}</span></div><div><strong>{scan.entities}</strong><span>{t('BSP entities')}</span></div></div>
            <div className="mp-filters">{(['all','ready','missing','builtin'] as const).map(mode=><button key={mode} className={filter===mode?'active':''} onClick={()=>setFilter(mode)}>{t(mode==='all'?'All':mode==='ready'?'Ready':mode==='missing'?'Missing':'Game built-in')}</button>)}</div>
            <div className="mp-items">{scan.entries.filter(e=>filter==='all'||e.status===filter||(filter==='missing'&&(e.status==='conflict'||e.status==='oversize'))).map(e=><div className="mp-item" key={e.path}>
              <input type="checkbox" aria-label={e.path} checked={e.status==='ready'&&selected.has(e.path.toLowerCase())} disabled={e.status!=='ready'||e.required} onChange={()=>toggle(e.path)}/>
              {e.status==='ready'?<CheckCircle2 size={15} color="#69dbaf"/>:<AlertTriangle size={15} color={e.status==='builtin'?'#8aa6bc':'#f9c16a'}/>}
              <div><b>{e.path}</b><small>{e.reason} · {e.layer||e.status} · {e.size?`${(e.size/1024).toFixed(1)} KB`:e.status}</small></div>
            </div>)}</div>
          </>:<div className="mp-empty"><FolderSearch size={38}/><p>{t('Analyze a compiled BSP to inspect resources before creating an archive.')}</p></div>}
        </main>
        <aside className="mp-right">
          <h3>{t('Package review')}</h3>
          <p className="mp-muted">{t('ZIP contents are placed at the root: maps/, models/, sound/, sprites/, gfx/ and scripts/maps/. Extract into svencoop_addon/.')}</p>
          {scan&&<>
            {scan.warnings.length>0&&<div className="mp-warning"><strong><AlertTriangle size={16}/>{t('Warnings')} ({scan.warnings.length})</strong>{scan.warnings.slice(0,12).map((w,i)=><p key={i}>{w}</p>)}</div>}
            {npcInstructions.length>0&&<div className="mp-warning"><strong>{t('Custom NPC setup')}</strong><p>{t('If not already present, add these lines to your existing map CFG manually:')}</p>{npcInstructions.map((line,i)=><code key={i}>{line}</code>)}</div>}
            {scan.missing>0&&<label className="mp-check"><input type="checkbox" checked={acknowledge} onChange={e=>setAcknowledge(e.target.checked)}/>{t('I understand the package is incomplete and want to create it anyway.')}</label>}
            <button className="mp-action" disabled={busy||scan.missing>0&&!acknowledge} onClick={()=>void download()}><Download size={16}/>{busy?t('Working...'):t('Generate ZIP')}</button>
          </>}
          <div className="mp-safety"><ShieldCheck size={17}/><span>{t('Read-only scan. Does not alter CFG, scripts, brushes, compiler settings or installed assets.')}</span></div>
          <p className="mp-muted">{t('AngelScript dynamic dependencies and third-party redistribution rights require manual verification.')}</p>
        </aside>
      </div>
      <footer className="mp-footer" aria-live="polite">{message||t('Select Analyze resources to begin.')}</footer>
    </section>
  </div>;
}
