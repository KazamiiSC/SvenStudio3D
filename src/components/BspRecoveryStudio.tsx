import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,FileDown,FilePlus2,RotateCcw,ShieldCheck,Trash2,X,FileInput,ScanSearch} from 'lucide-react';
import {addNativeEntity,addNativeProperty,nativeChanged,nativeClassname,nativeProperty,readNativeBsp,removeNativeEntity,removeNativeProperty,setNativeValue,writeNativeBsp} from '../engine/bspNativeEdit';
import {useT} from '../i18n';
import {inspectMapImport,type MapImportReport} from '../engine/importMap';
import {extractEmbeddedBspWad,appendRecoveryWadToMap} from '../engine/bspEmbeddedWad';
import {parseWad} from '../engine/wad';
import {restoreVisibleBspTextures,type SurfaceRestoreReport} from '../engine/bspSurfaceTextureRestore';
import type {BspMap} from '../engine/bsp';
import type {TextureAsset} from '../engine/types';

interface Props {source:ArrayBuffer;filename:string;map:BspMap;knownTextures:TextureAsset[];onClose:()=>void;onOpenMap:(source:string,name:string,textures?:TextureAsset[])=>Promise<boolean>}
export function BspRecoveryStudio({source,filename,map,knownTextures,onClose,onOpenMap}:Props){
  const t=useT();
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose()}event.stopImmediatePropagation()};window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true)},[onClose]);
  const [doc,setDoc]=useState(()=>readNativeBsp(source));
  const [selected,setSelected]=useState(0),[query,setQuery]=useState('');
  const [fieldKey,setFieldKey]=useState(''),[fieldValue,setFieldValue]=useState('');
  const [newClass,setNewClass]=useState('info_target'),[newOrigin,setNewOrigin]=useState('0 0 0');
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [decompilerPath,setDecompilerPath]=useState(()=>{try{return localStorage.getItem('svenstudio-surfdecomp-path')||''}catch{return ''}});
  const [converting,setConverting]=useState(false);
  const [converted,setConverted]=useState<{source:string;name:string;report:MapImportReport|null;diagnostic:string;log:string;entitySummary:string;embedded?:{name:string;bytes:Uint8Array;assets:TextureAsset[]};surfaceRestore?:SurfaceRestoreReport}|null>(null);
  const [convertError,setConvertError]=useState('');
  const convertBsp=async()=>{
    setConverting(true);setConvertError('');setConverted(null);
    try{
      // This operation is explicit. No unknown executable is launched just by opening the viewer.
      try{localStorage.setItem('svenstudio-surfdecomp-path',decompilerPath)}catch{/* Optional preference */}
      const conversionInput=nativeChanged(doc)?writeNativeBsp(doc):source;
      const response=await fetch('/api/bsp/decompile-map',{method:'POST',headers:{
        'Content-Type':'application/octet-stream','X-Sven-Decompiler':encodeURIComponent(decompilerPath.trim())
      },body:conversionInput});
      const result=await response.json().catch(()=>({error:`HTTP ${response.status}`}));
      if(!response.ok||typeof result.mapText!=='string')throw Error(result.error||`HTTP ${response.status}`);
      const name=filename.replace(/\.bsp$/i,'')+'_recovered.map';
      // Recover the original mipmap bytes where the BSP actually embeds pixels.
      // External-only texture names require WADs from the game installation.
      const recovered=extractEmbeddedBspWad(source,filename);
      let embedded: {name:string;bytes:Uint8Array;assets:TextureAsset[]}|undefined;
      if(recovered){
        try{
          const file=new File([new Uint8Array(recovered.bytes)],recovered.name,{type:'application/octet-stream'});
          embedded={name:recovered.name,bytes:recovered.bytes,assets:await parseWad(file)};
        }catch(error){
          setConvertError(`Embedded texture extraction could not be previewed: ${String(error)}`);
        }
      }
      // SurfDecomp can mark reconstructed planes NULL even when a visible BSP
      // surface provides exact material/texinfo. Only restore overlapping faces;
      // hidden faces remain NULL for GoldSrc compile optimization.
      const preflight=inspectMapImport(result.mapText,name);
      const surfaces=restoreVisibleBspTextures(result.mapText,map,preflight);
      const recoveredMap=embedded?appendRecoveryWadToMap(surfaces.source,embedded.name):surfaces.source;
      let report:MapImportReport|null=null,diagnostic='',entitySummary='';
      try{
        const inspected=inspectMapImport(recoveredMap,name);report=inspected.report;
        const parsedCount=inspected.project.objects.filter(object=>object.kind==='entity').length+1;
        entitySummary=`${parsedCount}/${doc.entities.length}`;
        if(parsedCount<doc.entities.length)diagnostic=t('Warning: the recovered MAP contains fewer entities than the original BSP. Review before importing.');
      }
      catch(error){diagnostic=String(error instanceof Error?error.message:error)}
      setConverted({source:recoveredMap,name,report,diagnostic,entitySummary,log:String(result.log||'').slice(-3000),embedded,surfaceRestore:surfaces.report});
    }catch(error){setConvertError(String(error instanceof Error?error.message:error))}
    finally{setConverting(false)}
  };
  const downloadMap=()=>{
    if(!converted)return;
    const url=URL.createObjectURL(new Blob([converted.source],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=converted.name;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),15000);
  };

  const recoveredNames=new Set([...knownTextures.map(t=>t.name.toLowerCase()),...map.textures.filter(t=>!!t.rgba).map(t=>t.name.toLowerCase())]);
  const missingExternal=map.textures.filter(t=>t.external&&!recoveredNames.has(t.name.toLowerCase())).map(t=>t.name);
  const uniqueMissing=[...new Set(missingExternal)];
  const downloadEmbeddedWad=()=>{
    if(!converted?.embedded)return;
    const {name,bytes}=converted.embedded;
    const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/octet-stream'}));
    const link=document.createElement('a');link.href=url;link.download=name;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),15000);
  };
  const entries=doc.entities;
  const active=entries[Math.min(selected,entries.length-1)];
  const filtered=useMemo(()=>entries.map((entity,index)=>({entity,index})).filter(({entity,index})=>`${nativeClassname(entity)} ${nativeProperty(entity,'targetname')} ${index}`.toLowerCase().includes(query.toLowerCase())).slice(0,1500),[entries,query]);
  const mutate=(fn:()=>ReturnType<typeof readNativeBsp>)=>{
    try{const next=fn();setDoc(next);setError('');setNotice('');return next}catch(e){setError(String(e instanceof Error?e.message:e));return null}
  };
  const download=()=>{
    try{
      const bytes=writeNativeBsp(doc);
      const blob=new Blob([bytes],{type:'application/octet-stream'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=filename.replace(/\.bsp$/i,'')+'_entities_edited.bsp';
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),15000);
      setNotice(t('Edited BSP copy downloaded. Open it in BSP Viewer to inspect changes. Original file untouched.'));
      setError('');
    }catch(e){setError(String(e instanceof Error?e.message:e))}
  };
  return <div className="modal-backdrop bsp-recovery-backdrop" onMouseDown={onClose}>
    <section className="bsp-recovery" role="dialog" aria-modal="true" aria-label={t('BSP Recovery')} onMouseDown={e=>e.stopPropagation()}>
      <header className="bsp-recovery-head"><div><strong><ShieldCheck size={18}/>{t('BSP Recovery')} — {t('Native entity editing')}</strong>
        <small>{filename} · BSP v30 · {entries.length} {t('Entities')}</small></div>
        <button title={t('Close')} onClick={onClose}><X size={19}/></button></header>
      <div className="bsp-recovery-caution"><AlertTriangle size={17}/><span>{t('This preview edits only compiled entity keyvalues. Geometry, textures, lightmaps, VIS and collision lumps are preserved byte-for-byte. Changes to baked lights or brush placement will not update compiled lighting or collisions. Always test the exported copy in Sven Co-op.')}</span></div>
      <div className="bsp-recovery-body">
        <aside className="bsp-recovery-list">
          <label>{t('Search entities...')}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="classname / targetname"/></label>
          <div className="bsp-recovery-items">{filtered.map(({entity,index})=><button key={index} className={selected===index?'selected':''} onClick={()=>{setSelected(index);setError('')}}>
            <span>{nativeClassname(entity)}</span><small>#{index} · {nativeProperty(entity,'targetname')||nativeProperty(entity,'origin')||'—'}</small>
          </button>)}</div>
        </aside>
        <div className="bsp-recovery-detail">
          {active&&<>
            <h3>{nativeClassname(active)} <small>#{selected}</small></h3>
            <p className="bsp-recovery-hint">{t('Edit existing keyvalues. This editor never changes compiled brush-model (*n) references. Multiple occurrences of the same key are preserved.')}</p>
            <div className="bsp-recovery-properties">{active.pairs.map((pair,i)=>{
              const brushModel=active.pairs.some(p=>p.key==='model'&&/^\*\d+$/.test(p.value));
              const locked=(brushModel&&['model','classname','origin','angles','angle','mins','maxs'].includes(pair.key))||(pair.key==='classname'&&nativeClassname(active)==='worldspawn');
              return <div className="bsp-recovery-property" key={`${selected}:${i}`}><code title={pair.key}>{pair.key}</code><input aria-label={`${pair.key} value`} value={pair.value} disabled={locked} onChange={e=>mutate(()=>setNativeValue(doc,selected,i,e.target.value))}/>
                <button disabled={locked||pair.key==='classname'} title={t('Delete keyvalue')} onClick={()=>mutate(()=>removeNativeProperty(doc,selected,i))}><Trash2 size={15}/></button>
              </div>;
            })}</div>
            <form className="bsp-recovery-form" onSubmit={e=>{e.preventDefault();if(mutate(()=>addNativeProperty(doc,selected,fieldKey.trim(),fieldValue))){setFieldKey('');setFieldValue('')}}}>
              <strong>{t('Add keyvalue')}</strong><div><input value={fieldKey} onChange={e=>setFieldKey(e.target.value)} placeholder="key" aria-label={t('Key')}/><input value={fieldValue} onChange={e=>setFieldValue(e.target.value)} placeholder="value" aria-label={t('Value')}/><button type="submit" disabled={!fieldKey.trim()}>{t('Add')}</button></div>
            </form>
            {selected>0&&<button className="bsp-recovery-danger" onClick={()=>{
              if(!confirm(t('Remove selected point entity from the exported BSP? This does not modify your original file.')))return;
              if(mutate(()=>removeNativeEntity(doc,selected)))setSelected(Math.max(0,selected-1));
            }}><Trash2 size={15}/>{t('Remove point entity')}</button>}
          </>}
          <form className="bsp-recovery-form" onSubmit={e=>{
            e.preventDefault();if(mutate(()=>addNativeEntity(doc,newClass.trim(),newOrigin.trim())))setSelected(doc.entities.length);
          }}><strong><FilePlus2 size={15}/>{t('Add point entity')}</strong>
            <div><input aria-label="classname" value={newClass} onChange={e=>setNewClass(e.target.value)} placeholder="info_target"/>
              <input aria-label="origin" value={newOrigin} onChange={e=>setNewOrigin(e.target.value)} placeholder="0 0 0"/>
              <button type="submit">{t('Add')}</button></div>
          </form>
        </div>
      </div>
      <section className="bsp-decompile-section" aria-label={t('Convert BSP to MAP')}>
        <div className="bsp-decompile-heading"><ScanSearch size={18}/><strong>{t('Convert BSP to editable MAP')}</strong></div>
        <p>{t('Reconstruct an editable .map with your own SurfDecomp installation. The original BSP stays unchanged. Decompilation cannot recover the exact original brushes, groups, or baked lighting.')}</p>
        <label className="bsp-decompile-path">{t('SurfDecomp executable path (optional)')}
          <input value={decompilerPath} disabled={converting} placeholder="C:\Tools\surfdecomp.exe" onChange={e=>setDecompilerPath(e.target.value)}/>
        </label>
        <small>{t('Leave blank if you placed surfdecomp.exe in the tools folder of SvenStudio 3D. Only run decompilers you trust.')}</small>
        <div className="bsp-decompile-actions">
          <button disabled={converting} onClick={()=>void convertBsp()}><ScanSearch size={15}/>{converting?t('Converting BSP...'):t('Decompile and validate')}</button>
          {converted&&<button onClick={downloadMap}><FileDown size={15}/>{t('Download recovered MAP')}</button>}
          {converted?.embedded&&<button onClick={downloadEmbeddedWad}><FileDown size={15}/>Download texture WAD ({converted.embedded.assets.length})</button>}
          {converted&&converted.report&&converted.report.totalBrushes>0&&<button className="primary-action" onClick={()=>void onOpenMap(converted.source,converted.name,[...knownTextures,...(converted.embedded?.assets||[])])}><FileInput size={15}/>{t('Open recovered MAP in editor')}</button>}
        </div>
        {convertError&&<div className="bsp-recovery-error" role="alert">{convertError}</div>}
        {converted&&<div className="bsp-decompile-report" role="status">
          <strong>{converted.report?t('MAP validation results'):t('MAP requires manual inspection')}</strong>
          {converted.entitySummary&&<p>{t('Recovered entities')}: {converted.entitySummary}</p>}
          {converted.surfaceRestore&&<p>{t('BSP surface textures restored')}: <b>{converted.surfaceRestore.restoredFaces}</b> / {converted.surfaceRestore.sourceNullFaces} {t('NULL faces analyzed')}.
            {converted.surfaceRestore.ambiguousFaces>0?` ${converted.surfaceRestore.ambiguousFaces} ${t('ambiguous faces left unchanged')}.`:''}</p>}
          {converted.surfaceRestore?.restoredFaces===0&&converted.surfaceRestore.sourceNullFaces>0&&<p className="bsp-decompile-warning">{t('No safe BSP surface matches found. NULL faces were kept. Inspect the source BSP and generated MAP together if textures remain missing.')}</p>}
          {converted.diagnostic&&<p className="bsp-decompile-warning">{converted.diagnostic}</p>}
          {converted.report?<p>{t('Recovered brushes')}: {converted.report.importedBrushes}/{converted.report.totalBrushes} · {t('Skipped brushes')}: {converted.report.skippedBrushes}</p>:null}
          {converted.report?.skippedBrushes? <p className="bsp-decompile-warning">{t('Importing this MAP would lose geometry. Review the report and confirm explicitly before replacing your current project.')}</p>:null}
          {converted.report?.skippedLocations?.length? <details><summary>{t('Skipped brush locations')}</summary><div>{converted.report.skippedLocations.join(' · ')}</div></details>:null}
          {converted.embedded&&<p className="bsp-decompile-warning">Embedded textures recovered to {converted.embedded.name}. Download this WAD, install it in svencoop_addon, and add its full path to build settings before compiling. The MAP references it automatically.</p>}
          {uniqueMissing.length>0&&<p className="bsp-decompile-warning">{uniqueMissing.length} external BSP texture names still have no matching WAD pixels: {uniqueMissing.slice(0,12).join(', ')}{uniqueMissing.length>12?'…':''}. Import the original WADs in BSP Viewer, then reopen Recovery.</p>}
          <small>{t('Textures from external WADs and compiled lightmaps may not be recoverable; load the corresponding WADs if necessary.')}</small>
          {converted.log&&<details><summary>{t('Decompiler output')}</summary><pre>{converted.log}</pre></details>}
        </div>}
      </section>
      {(error||notice)&&<div className={error?'bsp-recovery-error':'bsp-recovery-success'} role="status">{error||notice}</div>}
      <footer className="bsp-recovery-footer"><small>{nativeChanged(doc)?t('Unexported changes — original BSP not modified.'):t('No edits yet. Original BSP is read-only.')}</small>
        <button onClick={()=>{setDoc(readNativeBsp(source));setSelected(0);setError('');setNotice('')}} disabled={!nativeChanged(doc)}><RotateCcw size={15}/>{t('Discard edits')}</button>
        <button className="primary-action" disabled={!nativeChanged(doc)} onClick={download}><FileDown size={15}/>{t('Export edited BSP copy')}</button>
      </footer>
    </section>
  </div>;
}
