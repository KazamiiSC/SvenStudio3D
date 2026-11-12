import {useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,FileDown,FilePlus2,RotateCcw,ShieldCheck,Trash2,X,FileInput,ScanSearch,Merge} from 'lucide-react';
import {addNativeEntity,addNativeProperty,nativeChanged,nativeClassname,nativeProperty,readNativeBsp,removeNativeEntity,removeNativeProperty,setNativeValue,writeNativeBsp} from '../engine/bspNativeEdit';
import {useT} from '../i18n';
import {useStudioLayout} from '../layout';
import {importPointEntities,previewPointImport} from '../engine/bspCompose';
import {listBspBrushModels,transferBspSubmodel,InvalidBspLightstylesError,type BspSubmodelReport} from '../engine/bspSubmodelTransfer';
import {MissingBspWadTextureError} from '../engine/bspWadMipTexture';
import {composeRecoveredBspGeometry,CombinedMapVerificationError,type GeometryComposeResult} from '../engine/bspGeometryCompose';
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
  const [composeSource,setComposeSource]=useState<ReturnType<typeof readNativeBsp>|null>(null);
  const [composeName,setComposeName]=useState('');
  const [composeOffset,setComposeOffset]=useState('0 0 0');
  const [composePrefix,setComposePrefix]=useState('import_');
  const [composeBusy,setComposeBusy]=useState(false);
  const [binarySelected,setBinarySelected]=useState(-1);
  const [binaryWads,setBinaryWads]=useState<File[]>([]);
  const [binaryBusy,setBinaryBusy]=useState(false);
  const [binaryConfirmed,setBinaryConfirmed]=useState(false);
  const [binaryError,setBinaryError]=useState('');
  const [binaryResult,setBinaryResult]=useState<{bytes:ArrayBuffer;report:BspSubmodelReport}|null>(null);
  const binaryOptions=useMemo(()=>composeSource?listBspBrushModels(composeSource):[],[composeSource]);
  useEffect(()=>{setBinaryResult(null);setBinaryConfirmed(false);setBinaryError('')},[composeSource,doc,binarySelected,binaryWads]);
  const [recoveryTab,setRecoveryTab]=useState<'entities'|'compose'|'convert'>('entities');
  const [geometryStep,setGeometryStep]=useState('');
  const [optimizeLargeMap,setOptimizeLargeMap]=useState(true);
  const [openingCombined,setOpeningCombined]=useState(false);
  const [geometryMerging,setGeometryMerging]=useState(false);
  const [geometryResult,setGeometryResult]=useState<GeometryComposeResult|null>(null);
  const [geometryError,setGeometryError]=useState('');
  const [geometryRecovery,setGeometryRecovery]=useState<{primary:string;secondary:string;primaryReport:MapImportReport;secondaryReport:MapImportReport}|null>(null);
  const [partialConfirmed,setPartialConfirmed]=useState(false);
  const resetGeometry=()=>{setGeometryRecovery(null);setPartialConfirmed(false);setGeometryResult(null);setGeometryError('')};
  const geometryAbort=useRef<AbortController|null>(null);
  const [geometryElapsed,setGeometryElapsed]=useState(0);
  useEffect(()=>{if(!geometryMerging)return;const started=Date.now();const timer=window.setInterval(()=>setGeometryElapsed(Math.floor((Date.now()-started)/1000)),1000);return()=>window.clearInterval(timer)},[geometryMerging]);
  useEffect(()=>()=>{geometryAbort.current?.abort()},[]);
  const parseComposeOffset=()=>{const n=composeOffset.trim().split(/\s+/).map(Number);if(n.length!==3||!n.every(Number.isFinite))throw Error(t('Enter three numeric coordinates.'));return n};
  const importBspFile=async(file?:File)=>{
    if(!file)return;
    setComposeBusy(true);setComposeSource(null);setBinarySelected(-1);resetGeometry();setError('');
    try{if(!/\.bsp$/i.test(file.name))throw Error(t('Choose a BSP file.'));
      const loaded=readNativeBsp(await file.arrayBuffer());setComposeSource(loaded);setComposeName(file.name);
      const first=listBspBrushModels(loaded)[0];setBinarySelected(first?.entityIndex??-1);
    }catch(e){setError(String(e instanceof Error?e.message:e))}finally{setComposeBusy(false)}
  };
  const composePreview=useMemo(()=>{
    if(!composeSource)return null;
    try{return {report:previewPointImport(doc,composeSource,parseComposeOffset(),composePrefix),error:''}}
    catch(e){return {report:null,error:String(e instanceof Error?e.message:e)}}
  },[doc,composeSource,composeOffset,composePrefix]);
  const applyComposition=()=>{
    if(!composeSource)return;
    const next=mutate(()=>importPointEntities(doc,composeSource,parseComposeOffset(),composePrefix));
    if(next){setNotice(t('Point entities imported. Export a new BSP copy to keep these changes.'));setComposeSource(null)}
  };
  const analyzeBinaryModel=async()=>{
    if(!composeSource||binarySelected<1||binaryBusy)return;
    setBinaryResult(null);setBinaryConfirmed(false);setBinaryError('');setBinaryBusy(true);
    // Allow the status text to render. The first stage intentionally has strict
    // 64 MB / 2048-face / graph-size bounds and executes locally (no server call).
    await new Promise<void>(resolve=>window.setTimeout(resolve,0));
    try{
      if(binaryWads.length>8||binaryWads.some(f=>f.size>64*1024*1024)||binaryWads.reduce((total,f)=>total+f.size,0)>128*1024*1024)throw Error(t('WAD3 selection limit: up to 8 files, 64 MiB each and 128 MiB total.'));
      const wadFiles=await Promise.all(binaryWads.map(async file=>new Uint8Array(await file.arrayBuffer())));
      setBinaryResult(transferBspSubmodel(doc,composeSource,binarySelected,{wadFiles}));
    }catch(e){
      const detail=e instanceof InvalidBspLightstylesError
        ?`${t('Invalid BSP lightstyles on source face')} #${e.faceIndex}: [${e.styles.join(', ')}], lightofs=${e.lightofs}. ${t('Non-contiguous lightstyles cannot be transferred safely.')}`
        :e instanceof MissingBspWadTextureError
        ?`${t('Missing external BSP texture')}: ${e.textureName}. ${t(e.wadFilesProvided?'Texture not found in the selected WAD3 files. Select a WAD3 with this texture.':'Select the WAD3 file containing this texture below, then analyze again.')}`
        :String(e instanceof Error?e.message:e);
      setBinaryError(`${t('Transfer refused; no BSP file was created')}: ${detail}`);
    }
    finally{setBinaryBusy(false)}
  };
  const downloadBinaryModel=()=>{
    if(!binaryResult||!binaryConfirmed)return;
    const blob=new Blob([binaryResult.bytes],{type:'application/octet-stream'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename.replace(/\.bsp$/i,'')+`_model_${binaryResult.report.destModel}_merged.bsp`;
    document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),15000);
  };
  const runGeometryComposition=async()=>{
    if(!composeSource||geometryMerging)return;
    setGeometryMerging(true);setGeometryElapsed(0);resetGeometry();
    try{
      const offset=parseComposeOffset();
      try{localStorage.setItem('svenstudio-surfdecomp-path',decompilerPath)}catch{/* optional */}
      const path=encodeURIComponent(decompilerPath.trim());
      const job=new AbortController();geometryAbort.current=job;
      const recover=async(input:ArrayBuffer,step:string)=>{
        setGeometryStep(step);
        // One controller handles user cancellation and timeout, with the server
        // also terminating SurfDecomp when the HTTP connection closes.
        const timeout=window.setTimeout(()=>job.abort('timeout'),125_000);
        try{
          const res=await fetch('/api/bsp/decompile-map',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Sven-Decompiler':path},body:input,signal:job.signal});
          const data=await res.json().catch(()=>({error:`HTTP ${res.status}`}));
          if(!res.ok||typeof data.mapText!=='string')throw Error(data.error||`HTTP ${res.status}`);
          return data.mapText as string;
        }catch(error){
          if(job.signal.aborted)throw Error(t(job.signal.reason==='cancel'?'BSP recovery cancelled.':'BSP recovery timed out. Check SurfDecomp and try a smaller BSP.'));
          throw error;
        }finally{window.clearTimeout(timeout)}
      };
      const primary=await recover(nativeChanged(doc)?writeNativeBsp(doc):source,t('Recovering primary BSP...'));
      const primaryReport=inspectMapImport(primary,'primary-recovered.map').report;
      const secondary=await recover(composeSource.source,t('Recovering source BSP...'));
      const secondaryReport=inspectMapImport(secondary,'source-recovered.map').report;
      if(primaryReport.skippedBrushes||secondaryReport.skippedBrushes){
        setGeometryRecovery({primary,secondary,primaryReport,secondaryReport});
        return;
      }
      setGeometryStep(t('Validating combined MAP...'));
      // Yield a frame so the status remains visible before synchronous MAP validation.
      await new Promise<void>(resolve=>window.setTimeout(resolve,0));
      const result=composeRecoveredBspGeometry(primary,secondary,offset,composePrefix,filename.replace(/\.bsp$/i,'')+'_combined');
      setGeometryResult(result);
    }catch(e){setGeometryError(describeCompositionError(e))}
    finally{geometryAbort.current=null;setGeometryMerging(false);setGeometryStep('')}
  };
  const describeCompositionError=(error:unknown)=>error instanceof CombinedMapVerificationError
    ? `${t('Combined MAP verification failed')}: ${error.report.importedBrushes}/${error.expected} ${t('Recovered brushes')} · ${error.report.skippedBrushes} ${t('Skipped brushes')}${error.report.skippedLocations.length?' — '+error.report.skippedLocations.slice(0,3).join(' | '):''}`
    : String(error instanceof Error?error.message:error);
  const createConfirmedPartialMap=()=>{
    if(!geometryRecovery||!partialConfirmed||geometryMerging)return;
    setGeometryError('');setGeometryResult(null);
    try{
      const result=composeRecoveredBspGeometry(geometryRecovery.primary,geometryRecovery.secondary,parseComposeOffset(),composePrefix,filename.replace(/\.bsp$/i,'')+'_combined',{allowPartial:true});
      setGeometryResult(result);
    }catch(e){setGeometryError(describeCompositionError(e))}
  };
  const downloadGeometryDiagnostics=()=>{
    if(!geometryRecovery)return;
    const reports={primaryBSP:filename,sourceBSP:composeName,primary:geometryRecovery.primaryReport,secondary:geometryRecovery.secondaryReport,warning:'Unreconstructable brushes may be caused by SurfDecomp output or MAP reconstruction; original BSP geometry has not been compared.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(reports,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='svenstudio_bsp_recovery_diagnostic.json';document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),15000);
  };
  // Reuse the existing v1.9 Large maps viewport profile; never alter source geometry.
  const openCombinedMap=async()=>{
    if(!geometryResult||openingCombined)return;
    setOpeningCombined(true);
    const layout=useStudioLayout.getState();
    const previousPreset=layout.performancePreset;
    const needsLargePreset=optimizeLargeMap&&geometryResult.report.brushes>=2500;
    if(needsLargePreset)layout.setPerformancePreset('large');
    try{
      const opened=await onOpenMap(geometryResult.source,filename.replace(/\.bsp$/i,'')+'_combined.map',knownTextures);
      if(!opened&&needsLargePreset)useStudioLayout.getState().setPerformancePreset(previousPreset);
    }catch(e){
      if(needsLargePreset)useStudioLayout.getState().setPerformancePreset(previousPreset);
      setGeometryError(String(e instanceof Error?e.message:e));
    }finally{setOpeningCombined(false)}
  };
  const downloadGeometryMap=()=>{
    if(!geometryResult)return;
    const url=URL.createObjectURL(new Blob([geometryResult.source],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=filename.replace(/\.bsp$/i,'')+'_combined.map';
    document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),15000);
  };
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
      <header className="bsp-recovery-head"><div><strong><ShieldCheck size={18}/>{t('BSP Recovery')} — {t(recoveryTab==='compose'?'BSP composition':recoveryTab==='convert'?'Convert BSP to editable MAP':'Native entity editing')}</strong>
        <small>{filename} · BSP v30 · {entries.length} {t('Entities')}</small></div>
        <button title={t('Close')} onClick={onClose}><X size={19}/></button></header>
      <div className="bsp-recovery-caution"><AlertTriangle size={17}/><span>{t(recoveryTab==='compose'?'Composition does not overwrite original BSP files. The reconstructed MAP needs recompilation; its original lightmaps, VIS and collisions are not transferred.':'This preview edits only compiled entity keyvalues. Geometry, textures, lightmaps, VIS and collision lumps are preserved byte-for-byte. Changes to baked lights or brush placement will not update compiled lighting or collisions. Always test the exported copy in Sven Co-op.')}</span></div>
      <nav className="bsp-recovery-tabs" aria-label={t('BSP recovery sections')}>
        <button type="button" className={recoveryTab==='entities'?'active':''} aria-current={recoveryTab==='entities'?'page':undefined} onClick={()=>setRecoveryTab('entities')}>{t('Native entity editing')}</button>
        <button type="button" className={recoveryTab==='compose'?'active':''} aria-current={recoveryTab==='compose'?'page':undefined} onClick={()=>setRecoveryTab('compose')}>{t('BSP composition')}</button>
        <button type="button" className={recoveryTab==='convert'?'active':''} aria-current={recoveryTab==='convert'?'page':undefined} onClick={()=>setRecoveryTab('convert')}>{t('Convert BSP to editable MAP')}</button>
      </nav>
      {recoveryTab==='entities'&&<div className="bsp-recovery-body">
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
      </div>}
      {recoveryTab==='compose'&&<div className="bsp-recovery-tools-scroll">
      <section className="bsp-decompile-section" aria-label={t('BSP composition')}>
        <div className="bsp-decompile-heading"><Merge size={18}/><strong>{t('BSP composition — point entities')}</strong></div>
        <p>{t('Import point entities from another BSP into this BSP. Geometry, brush models, lightmaps, PVS and collision data are NOT merged. Original files are never overwritten.')}</p>
        <div className="bsp-decompile-actions">
          <label>{t('Source BSP')} <input type="file" accept=".bsp" disabled={composeBusy} onChange={e=>void importBspFile(e.target.files?.[0])}/></label>
        </div>
        {composeSource&&<>
          <p>{composeName}</p>
          <div className="bsp-decompile-actions">
            <label>{t('Offset XYZ')} <input aria-label={t('Offset XYZ')} value={composeOffset} onChange={e=>{setComposeOffset(e.target.value);resetGeometry()}}/></label>
            <label>{t('Target prefix')} <input aria-label={t('Target prefix')} value={composePrefix} onChange={e=>{setComposePrefix(e.target.value);resetGeometry()}}/></label>
          </div>
          {composePreview?.error&&<div className="bsp-recovery-error">{composePreview.error}</div>}
          {composePreview?.report&&<div className="bsp-decompile-report">
            <p>{t('Eligible point entities')}: <b>{composePreview.report.eligible}</b> · {t('Skipped brush entities')}: <b>{composePreview.report.skippedModels}</b></p>
            {composePreview.report.warnings.map((warning,i)=><p key={i} className="bsp-decompile-warning">{t(warning)}</p>)}
            <button className="primary-action" disabled={!composePreview.report.eligible||!!composePreview.report.conflicts||!!composePreview.report.badOrigins||doc.entities.length+composePreview.report.eligible>32768} onClick={applyComposition}>{t('Import point entities')}</button>
          </div>}
        </>}
      </section>
      <section className="bsp-decompile-section" aria-label={t('Binary BSP model transfer')}>
        <div className="bsp-decompile-heading"><Merge size={18}/><strong>{t('Binary BSP model transfer — compiled submodel')}</strong></div>
        <p>{t('Transfer one compiled brush model (for example a door or platform) directly into a verified BSP copy. No MAP conversion. This operation does not move coordinates, merge worldspawn, import linked point entities, or rebuild world VIS.')}</p>
        <small>{t('Source BSP is selected above. XYZ offset and target prefix do not apply to binary model transfer. Source and destination BSP files stay untouched.')}</small>
        {composeSource&&<>
          {binaryOptions.length>0?<div className="bsp-decompile-actions">
            <label>{t('Compiled source model')}
              <select value={binarySelected} disabled={binaryBusy} onChange={e=>setBinarySelected(Number(e.target.value))}>
                {binaryOptions.map(item=><option key={item.entityIndex} value={item.entityIndex}>
                  #{item.entityIndex} · *{item.modelIndex} · {item.classname} {item.targetname?`(${item.targetname})`:''} · {item.faces} faces
                </option>)}
              </select>
            </label>
            <button type="button" disabled={binaryBusy||binarySelected<1} onClick={()=>void analyzeBinaryModel()}>
              <ShieldCheck size={15}/>{binaryBusy?t('Validating compiled BSP model...'):t('Analyze and build verified BSP copy')}
            </button>
          </div>:<p className="bsp-decompile-warning">{t('The selected source BSP contains no compiled brush-model entities.')}</p>}
        </>}
        <div className="bsp-binary-wad-picker">
          <label>{t('WAD3 files for missing external textures (optional)')}
            <input type="file" accept=".wad" multiple disabled={binaryBusy} onChange={e=>setBinaryWads(Array.from(e.target.files||[]))}/>
          </label>
          <small>{t('Select the original halflife.wad or other WAD3 used when compiling the source map. This binary operation embeds only required missing textures in the new BSP copy; importing a WAD elsewhere in the editor does not supply its binary pixels here.')}</small>
          {binaryWads.length>0&&<div className="bsp-binary-wad-selected">{t('WAD3 files selected')}: {binaryWads.map(f=>f.name).join(', ')}</div>}
        </div>
        {binaryError&&<div className="bsp-recovery-error" role="alert">{binaryError}</div>}
        {binaryResult&&<div className="bsp-decompile-report" role="status">
          <strong>{t('Binary model validation passed')}</strong>
          <p>{binaryResult.report.classname} · *{binaryResult.report.sourceModel} → *{binaryResult.report.destModel}</p>
          <p>{t('Faces')}: {binaryResult.report.faces} · {t('Planes')}: {binaryResult.report.planes} · {t('Vertices')}: {binaryResult.report.vertices} · {t('Collision clipnodes')}: {binaryResult.report.clipnodes}</p>
          <p>{t('Imported embedded textures')}: {binaryResult.report.addedTextures} · {t('Textures resolved from WAD3')}: {binaryResult.report.wadTextures} · {t('Copied lightmap bytes')}: {binaryResult.report.lightmapBytes} · {t('BSP nodes')}: {binaryResult.report.nodes} · {t('Leaves')}: {binaryResult.report.leaves}</p>
          {binaryResult.report.unlitOffsetCorrections>0&&<p>{t('Unlit faces with unused lighting offsets normalized')}: {binaryResult.report.unlitOffsetCorrections}</p>}
          <p className="bsp-decompile-warning">{t('Check the door or platform in Sven Co-op. World visibility, external dependencies, entity connections and multiplayer behavior are not validated in-game.')}</p>
          <label className="bsp-recovery-partial-confirm"><input type="checkbox" checked={binaryConfirmed} onChange={e=>setBinaryConfirmed(e.target.checked)}/>{t('I understand this is a new BSP copy with one submodel, not a full binary map merge.')}</label>
          <button type="button" disabled={!binaryConfirmed} className="primary-action" onClick={downloadBinaryModel}><FileDown size={15}/>{t('Download verified BSP copy')}</button>
        </div>}
      </section>
      <section className="bsp-decompile-section" aria-label={t('Geometry composition')}>
        <div className="bsp-decompile-heading"><Merge size={18}/><strong>{t('Geometry composition — reconstructed MAP')}</strong></div>
        <p>{t('Recover geometry and brush entities from both BSP files, then create a combined editable MAP. This requires recompilation and does not preserve original baked lighting, PVS or collision data.')}</p>
        <small>{t('Choose a source BSP above and set its XYZ offset and target prefix. The conversion uses the configured SurfDecomp path below.')}</small>
        <label className="bsp-decompile-path">{t('SurfDecomp executable path (optional)')}
          <input value={decompilerPath} disabled={geometryMerging} placeholder="C:\Tools\surfdecomp.exe" onChange={e=>{setDecompilerPath(e.target.value);resetGeometry()}}/>
        </label>
        <small>{t('Leave blank if you placed surfdecomp.exe in the tools folder of SvenStudio 3D. Only run decompilers you trust.')}</small>
        <div className="bsp-decompile-actions">
          <button disabled={!composeSource||geometryMerging||composeBusy} onClick={()=>void runGeometryComposition()}><Merge size={15}/>{geometryMerging?t('Recovering both BSP maps...'):t('Create combined MAP')}</button>
          {geometryMerging&&<button onClick={()=>geometryAbort.current?.abort('cancel')}>{t('Cancel recovery')}</button>}
          {geometryResult&&<button onClick={downloadGeometryMap}><FileDown size={15}/>{t('Download combined MAP')}</button>}
          {geometryResult&&<button className="primary-action" disabled={openingCombined} onClick={()=>void openCombinedMap()}><FileInput size={15}/>{openingCombined?t('Opening combined MAP...'):t('Open combined MAP in editor')}</button>}
        </div>
        {geometryResult&&<div className="bsp-compose-performance">
          <label><input type="checkbox" checked={optimizeLargeMap} onChange={e=>setOptimizeLargeMap(e.target.checked)}/>{t('Use Large maps preview mode when opening a large composition')}</label>
          <small>{t('For compositions of 2,500+ brushes, lower viewport preview costs automatically. MAP geometry, textures and export are unchanged. You can change this later in Workspace.')}</small>
        </div>}
        {geometryMerging&&<div className="bsp-recovery-progress" role="status" aria-live="polite"><span className="bsp-recovery-spinner"/>{geometryStep} · {geometryElapsed}s — {t('External decompilation can take several minutes on large maps.')}</div>}
        {geometryError&&<div className="bsp-recovery-error" role="alert">{geometryError}</div>}
        {geometryRecovery&&<div className="bsp-decompile-report" role="status">
          <strong>{t('Geometry recovery diagnostic')}</strong>
          <p>{t('Primary BSP')}: {geometryRecovery.primaryReport.importedBrushes}/{geometryRecovery.primaryReport.totalBrushes} {t('Recovered brushes')} · {geometryRecovery.primaryReport.skippedBrushes} {t('Skipped brushes')}</p>
          <p>{t('Source BSP')}: {geometryRecovery.secondaryReport.importedBrushes}/{geometryRecovery.secondaryReport.totalBrushes} {t('Recovered brushes')} · {geometryRecovery.secondaryReport.skippedBrushes} {t('Skipped brushes')}</p>
          <p className="bsp-decompile-warning">{t('Some MAP brushes cannot be reconstructed. This does not prove that SurfDecomp lost the original BSP geometry. Review the diagnostic before continuing.')}</p>
          {([['Primary BSP',geometryRecovery.primaryReport],['Source BSP',geometryRecovery.secondaryReport]] as const).map(([label,report])=>report.skippedLocations.length>0&&<details key={label}><summary>{t(label)} — {t('Skipped brush locations')} ({report.skippedBrushes})</summary><div className="bsp-recovery-diagnostic-list">{report.skippedLocations.map((location,i)=><p key={i}>{location}</p>)}</div></details>)}
          <div className="bsp-decompile-actions"><button onClick={downloadGeometryDiagnostics}><FileDown size={15}/>{t('Download recovery diagnostic')}</button></div>
          <label className="bsp-recovery-partial-confirm"><input type="checkbox" checked={partialConfirmed} onChange={e=>setPartialConfirmed(e.target.checked)}/>{t('I understand that unreconstructable brushes will be omitted from the partial MAP.')}</label>
          <button disabled={!partialConfirmed} onClick={createConfirmedPartialMap}>{t('Create partial MAP (geometry loss)')}</button>
        </div>}
        {geometryResult&&<div className="bsp-decompile-report" role="status">
          <strong>{t(geometryResult.report.partial?'Partial MAP generated — inspect missing geometry':'Combined MAP validation passed')}</strong>
          <p>{t('Recovered brushes')}: {geometryResult.report.brushes} · {t('Entities')}: {geometryResult.report.entities}</p>
          {geometryResult.report.partial&&<p className="bsp-decompile-warning">{t('Partial recovery: omitted brushes')} {geometryResult.report.lostBrushes}</p>}
          <p className="bsp-decompile-warning">{t('The MAP must be compiled again. Original lightmaps, visibility and collision data are not copied.')}</p>
          <p className="bsp-decompile-warning">{t('Check WADs, models, scripts, spawn points and gameplay triggers before using the map.')}</p>
        </div>}
      </section>
      </div>}
      {recoveryTab==='convert'&&<div className="bsp-recovery-tools-scroll">
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
      </div>}
      {(error||notice)&&<div className={error?'bsp-recovery-error':'bsp-recovery-success'} role="status">{error||notice}</div>}
      <footer className="bsp-recovery-footer"><small>{nativeChanged(doc)?t('Unexported changes — original BSP not modified.'):t('No edits yet. Original BSP is read-only.')}</small>
        <button onClick={()=>{setDoc(readNativeBsp(source));setSelected(0);setError('');setNotice('')}} disabled={!nativeChanged(doc)}><RotateCcw size={15}/>{t('Discard edits')}</button>
        <button className="primary-action" disabled={!nativeChanged(doc)} onClick={download}><FileDown size={15}/>{t('Export edited BSP copy')}</button>
      </footer>
    </section>
  </div>;
}
