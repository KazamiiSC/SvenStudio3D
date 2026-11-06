import {useMemo,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,Download,FileCode2,FolderOpen,PackagePlus,Save,ShieldCheck,Trash2,X} from 'lucide-react';
import {useEditor} from '../store';
import {parseFgd} from '../engine/fgd';
import {assetRelativePath,cleanPackagePath,customNpcFiles,customNpcWarnings,hasMapInit,makeZip,possibleRegistrationFunctions,registeredCustomClassnames,scriptRelativePath,validateCustomNpc,
  EMPTY_CUSTOM_NPCS,type CustomNpcDefinition,type CustomNpcScript,type PackageFile} from '../engine/customNpc';
import type {FgdClass} from '../engine/types';
import {useT} from '../i18n';

const scriptsLimit=5_000_000;
function getPath(file:File){return file.webkitRelativePath||file.name}
function inferModel(scripts:CustomNpcScript[]):string{
  const match=scripts.map(s=>s.source).join('\n').match(/models\/[A-Za-z0-9_./-]+\.mdl/i);
  return match?.[0]||'';
}
export function CustomNpcImporter({onClose}:{onClose:()=>void}){
  const t=useT();
  const imported=useEditor(s=>s.project.customNpcs??EMPTY_CUSTOM_NPCS),register=useEditor(s=>s.registerCustomNpc),remove=useEditor(s=>s.removeCustomNpc);
  const projectName=useEditor(s=>s.settings.mapName);
  const uploadRef=useRef<HTMLInputElement|null>(null),folderRef=useRef<HTMLInputElement|null>(null),assetRef=useRef<HTMLInputElement|null>(null);
  const [classname,setClassname]=useState(''),[description,setDescription]=useState(''),[modelPath,setModelPath]=useState('');
  const [entry,setEntry]=useState(''),[registration,setRegistration]=useState('');
  const [scripts,setScripts]=useState<CustomNpcScript[]>([]),[assets,setAssets]=useState<File[]>([]);
  const [optionalFgd,setOptionalFgd]=useState<FgdClass|undefined>();
  const [notice,setNotice]=useState('');
  const [readyClass,setReadyClass]=useState('');
  const detected=useMemo(()=>registeredCustomClassnames(scripts),[scripts]);
  const functions=useMemo(()=>possibleRegistrationFunctions(scripts.map(s=>s.source).join('\n')),[scripts]);
  const definition:CustomNpcDefinition={classname:classname.trim(),description:description.trim(),modelPath:modelPath.trim(),entryScript:entry,registerFunction:registration.trim(),scripts,fgd:optionalFgd?.name===classname.trim()?optionalFgd:undefined};
  const errors=useMemo(()=>validateCustomNpc(definition),[classname,description,modelPath,entry,registration,scripts,optionalFgd]);
  const warnings=useMemo(()=>!errors.length?customNpcWarnings(definition):[],[classname,description,modelPath,entry,registration,scripts,optionalFgd,errors.length]);
  const loadFiles=async(files:File[])=>{
    try{
      if(files.length>600)throw Error('Too many files (max 600). Select a smaller package.');
      const scriptFiles=files.filter(f=>f.name.toLowerCase().endsWith('.as'));
      if(!scriptFiles.length)throw Error('No .as scripts found. Select source files or a folder containing them.');
      if(scriptFiles.length>40||scriptFiles.reduce((n,f)=>n+f.size,0)>scriptsLimit)throw Error('Maximum: 40 .as scripts / 5 MB of source.');
      const next:CustomNpcScript[]=await Promise.all(scriptFiles.map(async f=>({path:scriptRelativePath(getPath(f)),source:await f.text()})));
      for(const s of next)cleanPackagePath(s.path);
      const candidates=registeredCustomClassnames(next);
      const preferred=next.find(s=>hasMapInit(s.source))?.path||next[0].path;
      const funcs=possibleRegistrationFunctions(next.map(s=>s.source).join('\n'));
      setScripts(next);setEntry(preferred);setClassname(candidates[0]||'');setRegistration(hasMapInit(next.find(s=>s.path===preferred)!.source)?'':(funcs[0]||''));
      setDescription('');setModelPath(inferModel(next));setOptionalFgd(undefined);setReadyClass('');
      const resources=files.filter(f=>!f.name.toLowerCase().endsWith('.as')&&/\.(mdl|wav|spr|bmp|tga|txt|cfg|json)$/i.test(f.name));
      setAssets(resources);setNotice(`${next.length} .as scripts loaded; ${resources.length} possible resource files selected. Files are not executed.`);
    }catch(error){setNotice(String(error instanceof Error?error.message:error))}
  };
  const importFgd=async(file:File|undefined)=>{
    if(!file)return;
    try{if(file.size>1_000_000)throw Error('FGD exceeds 1 MB. Import only the small custom definition.');
      const matches=parseFgd(await file.text());const found=matches.find(c=>c.name===classname&&c.type==='point');
      if(!found)throw Error(`The FGD has no @PointClass named ${classname}.`);
      setOptionalFgd(found);setDescription(found.description);setModelPath(found.studio||modelPath);setNotice(`FGD definition loaded: ${found.name}`);
    }catch(error){setNotice(String(error instanceof Error?error.message:error))}
  };
  const chooseExisting=(item:CustomNpcDefinition)=>{
    setClassname(item.classname);setDescription(item.description);setModelPath(item.modelPath);setEntry(item.entryScript);setRegistration(item.registerFunction);
    setScripts(item.scripts);setOptionalFgd(item.fgd);setAssets([]);setReadyClass(item.classname);
    setNotice('Definition restored from project. Re-select model/sound files before exporting if needed.');
  };
  const save=()=>{
    try{if(errors.length)throw Error(errors.join('\n'));
      register(definition);setReadyClass(definition.classname);setNotice(`${definition.classname} registered in this SvenStudio project. AngelScript still needs to be installed and loaded in the game.`);
    }catch(error){setNotice(String(error instanceof Error?error.message:error))}
  };
  const download=async()=>{
    try{
      if(errors.length)throw Error(errors.join('\n'));
      if(assets.some(f=>f.size>100_000_000)||assets.reduce((n,f)=>n+f.size,0)>180_000_000)throw Error('Selected resources exceed 180 MB. Split the package or install files manually.');
      const resourceFiles:PackageFile[]=[];
      for(const file of assets){const path=assetRelativePath(getPath(file));resourceFiles.push({path,bytes:new Uint8Array(await file.arrayBuffer())})}
      const {files,mapScript}=customNpcFiles(definition,projectName,resourceFiles);
      const url=URL.createObjectURL(makeZip(files));const link=document.createElement('a');
      link.href=url;link.download=`SvenStudio_CustomNPC_${definition.classname}.zip`;document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60_000);
      setNotice(`ZIP created. Extract into svencoop_addon/ and add «map_script ${mapScript}» to the EXISTING maps/${projectName}.cfg. Do not overwrite the CFG.`);
    }catch(error){setNotice(String(error instanceof Error?error.message:error))}
  };
  return <div className="modal-backdrop custom-npc-backdrop" onMouseDown={onClose}>
    <section className="custom-npc-shell" role="dialog" aria-modal="true" aria-label={t('Custom NPC Importer')} onMouseDown={e=>e.stopPropagation()}>
      <header className="custom-npc-header"><FileCode2 size={20}/><div><strong>{t('Custom NPC Importer')}</strong><small>{t('AngelScript custom entities — read-only import, no execution')}</small></div><button onClick={onClose} title={t('Close')}><X size={19}/></button></header>
      <div className="custom-npc-columns">
        <aside className="custom-npc-library">
          <h3>{t('Imported NPC definitions')}</h3>
          {imported.length===0&&<p className="npc-hint">{t('No custom NPCs registered in this project yet.')}</p>}
          {imported.map(item=><div className="custom-npc-saved" key={item.classname}>
            <button onClick={()=>chooseExisting(item)}><strong>{item.classname}</strong><small>{item.modelPath||item.description||'AngelScript'}</small></button>
            <button title={t('Remove definition')} onClick={()=>{if(window.confirm(`${t('Remove definition')} ${item.classname}?`)){remove(item.classname);if(readyClass===item.classname)setReadyClass('');}}}><Trash2 size={15}/></button>
          </div>)}
          <p className="npc-hint">{t('Removing a definition does not delete entities already placed in the map.')}</p>
        </aside>
        <main className="custom-npc-form">
          <h3>{t('Import existing AngelScript sources')}</h3>
          <div className="custom-npc-actions">
            <button onClick={()=>uploadRef.current?.click()}><FileCode2 size={15}/>{t('Select .as files')}</button>
            <button onClick={()=>folderRef.current?.click()}><FolderOpen size={15}/>{t('Select NPC folder')}</button>
          </div>
          <input ref={uploadRef} hidden type="file" accept=".as" multiple onChange={e=>{void loadFiles(Array.from(e.target.files||[]));e.target.value=''}}/>
          <input ref={node=>{folderRef.current=node;if(node)node.setAttribute('webkitdirectory','')}} hidden type="file" multiple onChange={e=>{void loadFiles(Array.from(e.target.files||[]));e.target.value=''}}/>
          <div className="npc-hint">{t('Select all related .as files, including relative #include dependencies. No code is run by the editor.')}</div>
          {scripts.length>0&&<p className="custom-npc-count"><CheckCircle2 size={15}/> {scripts.length} .as · {detected.length} {t('detected classnames')}</p>}
          {detected.length>0&&<div className="custom-npc-actions">{detected.map(name=><button key={name} onClick={()=>setClassname(name)} className={classname===name?'active':''}>{name}</button>)}</div>}
          <div className="custom-npc-fields">
            <label>{t('Entity classname')}<input value={classname} onChange={e=>setClassname(e.target.value)} placeholder="monster_custom_gorilla" spellCheck={false}/></label>
            <label>{t('NPC description')}<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Custom AngelScript NPC"/></label>
            <label>{t('Main .as script')}<select value={entry} onChange={e=>{setEntry(e.target.value);setRegistration(hasMapInit(scripts.find(s=>s.path===e.target.value)?.source||'')?'':registration)}}>{scripts.length===0&&<option value="">—</option>}{scripts.map(s=><option key={s.path} value={s.path}>{s.path}</option>)}</select></label>
            <label>{t('Registration function (if no MapInit)')}<input value={registration} onChange={e=>setRegistration(e.target.value)} placeholder="RegisterCustomMonster" spellCheck={false}/></label>
            <label>{t('Model path')}<input value={modelPath} onChange={e=>setModelPath(e.target.value)} placeholder="models/my_mod/gorilla.mdl" spellCheck={false}/></label>
          </div>
          {functions.length>0&&<div className="custom-npc-functions"><span>{t('Suggested registration functions')}:</span>{functions.slice(0,12).map(fn=><button onClick={()=>setRegistration(fn)} key={fn}>{fn}</button>)}</div>}
          <label className="custom-npc-fgd">{t('Optional custom .FGD')} <input type="file" accept=".fgd" onChange={e=>{void importFgd(e.target.files?.[0]);e.target.value=''}}/></label>
          {errors.length>0&&<div className="custom-npc-issues">{errors.slice(0,6).map((msg,i)=><p key={i}><AlertTriangle size={15}/>{msg}</p>)}</div>}
          {warnings.length>0&&<div className="custom-npc-warnings">{warnings.map((msg,i)=><p key={i}><AlertTriangle size={15}/>{msg}</p>)}</div>}
          <button className="npc-primary" disabled={errors.length>0} onClick={save}><Save size={16}/>{t('Register in this project')}</button>
        </main>
        <aside className="custom-npc-export">
          <h3><PackagePlus size={16}/>{t('Prepare game package')}</h3>
          <p className="npc-hint">{t('Export an additive ZIP containing the .as scripts, selected assets, and an installation guide for svencoop_addon.')}</p>
          <p className="npc-hint"><strong>{t('Target map')}:</strong> {projectName}.bsp</p>
          <button className="custom-npc-resource" onClick={()=>assetRef.current?.click()}><FolderOpen size={16}/>{t('Add resource files')}</button>
          <input ref={node=>{assetRef.current=node;if(node)node.setAttribute('webkitdirectory','')}} hidden type="file" multiple onChange={e=>{setAssets(Array.from(e.target.files||[]).filter(f=>/\.(mdl|wav|mp3|ogg|spr|bmp|tga|txt|cfg|json|wad)$/i.test(f.name)));e.target.value=''}}/>
          <p className="npc-hint">{assets.length} {t('assets selected')}. {t('Use paths beginning with models/, sound/, sprites/, gfx/ or events/.')}</p>
          {assets.length>0&&<div className="custom-npc-files">{assets.slice(0,15).map((f,i)=><div key={i}>{getPath(f)}</div>)}{assets.length>15&&<p>+{assets.length-15}</p>}</div>}
          <button className="npc-primary" disabled={errors.length>0} onClick={()=>{void download()}}><Download size={16}/>{t('Download install ZIP')}</button>
          <p className="npc-hint">{t('The bundle NEVER overwrites an existing map CFG; add the map_script line manually. A static validator cannot prove AngelScript runtime compatibility.')}</p>
          <div className="custom-npc-safety"><ShieldCheck size={16}/>{t('No changes to BSP compiler, brush geometry, FGD parser or installed game files.')}</div>
          {readyClass&&<p className="npc-ok"><CheckCircle2 size={15}/>{readyClass}: {t('saved')}</p>}
        </aside>
      </div>
      <footer className="custom-npc-footer" aria-live="polite">{notice||t('Scripts are only read and packaged; never executed in the editor.')}</footer>
    </section>
  </div>
}
