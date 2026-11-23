import express from 'express';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import {listModels,openModel} from './modelAssets.js';
import {listSounds,streamSound} from './soundAssets.js';
import {installConvertedSound} from './audioConvertInstall.js';
import {inspectSoundReference} from './soundDiagnostics.js';
import {listSkies,skyFace} from './skyAssets.js';
import {findBspWadTextures} from './bspWadAssets.js';
import {prepareCompileWads,patchWorldWads} from './compileWads.js';
import {planSmartWadBuild,smartWadFilename,assertNoInstalledWadCollision} from './smartWadBuild.js';
import {installPrefabWad} from './prefabWadInstall.js';
import {resolveCompilerProfile} from './sdhltCompiler.js';
import {isCS16GameDirectory,loadCS16Fgd} from './cs16Profile.js';
import {inspectBspFile,bspLimitReport} from './bspAudit.js';
import {createHash} from 'node:crypto';
import {readBuildLeakPointfile} from './leakPointfile.js';
import {inspectMapPackage,createMapPackage} from './mapPackager.js';
import {writeDistribution} from './compiledDistribution.js';
import {validateExternalRoots,externalWadSearchFolders} from './externalResources.js';
import {validateBuildDestination,writeIsolatedBuild,compileOutputMode} from './isolatedBuild.js';
import {makePortableBsp} from './portableBsp.js';
import {decompileBspToMap} from './surfDecompile.js';
import {lightTestSettings,lightTestRadArgs} from './lightingTest.js';
import {attachBuildTogether} from './buildTogether.js';
import {mountedRoots,discoverInstallations,browseLocalFolder,verifyLocalInstall} from './installationDiscovery.js';
import {createLightingPreviewRecord,isPreviewCompile,lightingPreviewAvailable} from './lightingPreviewBuild.js';
import {studioFolders,saveStudioFile,listStudioFiles,readStudioFile,studioDirectory} from './studioDocuments.js';
import {pickWindowsFolder} from './nativeWindowsDialogs.js';
import {listHistory,createHistorySnapshot,readHistorySnapshot} from './projectHistory.js';
import {gameIconPng} from './gameIcons.js';
import {localApiGuard,allowedPorts,isLocalOrigin} from './localGuard.js';
import {launchGame} from './gameLauncher.js';
import {projectPath} from './paths.js';
import {readSharedSettings,writeSharedSettings} from './sharedSettings.js';

const PORT=Number(process.env.SVEN_API_PORT||49177);
const app=express();
app.disable('x-powered-by');
// Every route answers only the local UI (see server/localGuard.js).
app.use(localApiGuard(PORT));
app.use(express.json({limit:'36mb'}));let active=null;let lastLightingPreview=null;let lastCompiledOutput=null;
const stages=['CSG','BSP','VIS','RAD'];
const validMapName=s=>typeof s==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(s);
const isDir=async p=>{try{return (await fs.stat(p)).isDirectory()}catch{return false}};
const send=(res,type,message,extra={})=>res.write(`${JSON.stringify({type,message,...extra})}\n`);
app.get('/api/health',(_req,res)=>res.json({ok:true,platform:process.platform,stages}));

// Only the loopback UI may request local document writes. Never accept a user
// supplied output path, and never silently overwrite an existing document.
const studioOriginAllowed=req=>{
 const origin=req.headers.origin;
 if(!origin)return true;
 // v2.4: the desktop app serves the UI from the API port itself, so allow the same local ports as the guard.
 return isLocalOrigin(origin,allowedPorts(PORT));
};
app.get('/api/studio-files/paths',async(req,res)=>{
 try{return res.json(await studioFolders(true))}catch(error){return res.status(500).json({error:String(error.message||error)})}
});
app.get('/api/studio-files/list',async(req,res)=>{
 try{return res.json({files:await listStudioFiles(req.query.category)})}catch(error){return res.status(400).json({error:String(error.message||error)})}
});
app.get('/api/studio-files/read',async(req,res)=>{
 try{return res.type('application/octet-stream').set('Cache-Control','no-store').send(await readStudioFile(req.query.category,req.query.name))}
 catch(error){return res.status(400).json({error:String(error.message||error)})}
});
app.post('/api/studio-files/save',express.raw({type:'application/octet-stream',limit:'128mb'}),async(req,res)=>{
 if(!studioOriginAllowed(req))return res.status(403).json({error:'Untrusted origin.'});
 try{
  const category=String(req.headers['x-sven-category']||'');
  const filename=decodeURIComponent(String(req.headers['x-sven-filename']||''));
  const result=await saveStudioFile({category,filename,bytes:req.body});
  return res.json(result);
 }catch(error){return res.status(400).json({error:String(error.message||error)})}
});

// HF14 persistent history: read-only listing, immutable snapshots, no arbitrary file paths.
app.get('/api/project-history/list',async(_req,res)=>{
 try{return res.set('Cache-Control','no-store').json({entries:await listHistory()})}
 catch(error){return res.status(500).json({error:String(error.message||error)})}
});
app.get('/api/project-history/read',async(req,res)=>{
 try{return res.set('Cache-Control','no-store').json(await readHistorySnapshot(req.query.id))}
 catch(error){return res.status(400).json({error:String(error.message||error)})}
});
app.post('/api/project-history/save',express.raw({type:'application/octet-stream',limit:'64mb'}),async(req,res)=>{
 if(!studioOriginAllowed(req))return res.status(403).json({error:'Untrusted origin.'});
 try{
  if(!Buffer.isBuffer(req.body))throw Error('Missing project checkpoint.');
  const {project,kind,label}=JSON.parse(req.body.toString('utf8'));
  return res.json(await createHistorySnapshot({project,kind,label}));
 }catch(error){return res.status(400).json({error:String(error.message||error)})}
});

// Localhost-only setup assistance. Read-only: never writes to the selected drive.
app.get('/api/setup/roots',async(_req,res)=>{
 try{return res.json({roots:await mountedRoots(),platform:process.platform});}
 catch(e){return res.status(500).json({error:String(e.message||e)});}
});
app.post('/api/setup/native-folder',async(req,res)=>{
 if(!studioOriginAllowed(req))return res.status(403).json({error:'Untrusted origin.'});
 try{return res.json(await pickWindowsFolder(req.body?.initial))}
 catch(error){return res.status(500).json({error:String(error.message||error)})}
});
app.post('/api/setup/folders',async(req,res)=>{
 try{return res.json(await browseLocalFolder(req.body?.path));}
 catch(e){return res.status(400).json({error:String(e.message||e)});}
});
app.post('/api/setup/detect',async(_req,res)=>{
 try{return res.json(await discoverInstallations());}
 catch(e){return res.status(500).json({error:String(e.message||e)});}
});
app.post('/api/setup/verify',async(req,res)=>{
 const kind=req.body?.kind;
 if(kind!=='game'&&kind!=='compiler')return res.status(400).json({error:'Invalid folder type.'});
 return res.json({valid:await verifyLocalInstall(req.body?.path,kind)});
});

// Read-only access to the BSP produced in the configured Sven Co-op maps folder.
// No arbitrary filename or user-supplied file path may be requested through this endpoint.
app.post('/api/bsp/compiled',async(req,res)=>{
  const {gameDir,mapName}=req.body||{};
  if(!validMapName(mapName)||typeof gameDir!=='string'||gameDir.length>1024||!(await isDir(gameDir)))
    return res.status(400).json({error:'Configure the game directory and valid map name first.'});
  try{
    const file=lastCompiledOutput?.mapName===mapName&&lastCompiledOutput.gameDir===path.resolve(gameDir)?lastCompiledOutput.file:path.join(gameDir,'maps',`${mapName}.bsp`);
    const stat=await fs.stat(file);
    if(!stat.isFile()||stat.size<124||stat.size>256*1024*1024)
      return res.status(400).json({error:'BSP file is empty or exceeds 256 MB.'});
    res.type('application/octet-stream').send(await fs.readFile(file));
  }catch{return res.status(404).json({error:'Compiled BSP not found. Compile first or open a local .bsp file.'})}
});

// Ephemeral SC-RAD preview: accepts only a random identifier issued by this
// process. It cannot read an arbitrary file path or installed map.
app.post('/api/lighting-preview/bsp',async(req,res)=>{
  const id=req.body?.previewId;
  if(!lightingPreviewAvailable(lastLightingPreview,id))return res.status(404).json({error:'Lighting preview has expired. Rebuild the preview.'});
  try{
    const record=lastLightingPreview;
    const stat=await fs.stat(record.file);
    if(!stat.isFile()||stat.size!==record.size)return res.status(404).json({error:'Preview BSP changed or is unavailable.'});
    return res.setHeader('Cache-Control','no-store').type('application/octet-stream').send(await fs.readFile(record.file));
  }catch{return res.status(404).json({error:'Preview BSP is no longer available.'})}
});
// Read-only packaging of a compiled BSP and Sven Co-op addon dependencies.
app.post('/api/packager/scan',async(req,res)=>{
  try{const {compiledBspPath,inlineBinaryFiles,...safe}=req.body||{};const recent=lastCompiledOutput?.mapName===safe.mapName&&lastCompiledOutput?.gameDir===path.resolve(safe.gameDir||'')?lastCompiledOutput:null;return res.json(await inspectMapPackage({...safe,...(recent?{compiledBspPath:recent.file,inlineBinaryFiles:recent.inlineBinaryFiles}: {})}));}
  catch(error){return res.status(400).json({error:String(error?.message||error)});}
});
app.post('/api/packager/download',async(req,res)=>{
  try{
    const {compiledBspPath,inlineBinaryFiles,...safe}=req.body||{};const recent=lastCompiledOutput?.mapName===safe.mapName&&lastCompiledOutput?.gameDir===path.resolve(safe.gameDir||'')?lastCompiledOutput:null;const {zip}=await createMapPackage({...safe,...(recent?{compiledBspPath:recent.file,inlineBinaryFiles:recent.inlineBinaryFiles}: {})});
    return res.setHeader('Content-Disposition','attachment; filename="svenstudio-map-package.zip"')
      .setHeader('Cache-Control','no-store').type('application/zip').send(zip);
  }catch(error){return res.status(400).json({error:String(error?.message||error)});}
});
// Stop a running build and its compiler process tree.
const cancelTask=task=>{if(!task)return false;task.cancelled=true;if(task.child){
  if(process.platform==='win32')execFile('taskkill',['/PID',String(task.child.pid),'/T','/F'],()=>{});
  else task.child.kill('SIGTERM');
 }return true;};
app.post('/api/cancel',(_req,res)=>res.json({cancelled:cancelTask(active)}));
// Post-build actions use ONLY the last output produced by this server process.
// Re-installing an already compiled map never executes SC-CSG/BSP/VIS/RAD.
app.post('/api/compile/install-last',async(req,res)=>{
 if(active)return res.status(409).json({error:'Wait until the current build finishes.'});
 const last=lastCompiledOutput;
 if(!last||req.body?.confirm!==true||req.body?.mapName!==last.mapName||
    req.body?.gameDir!==last.gameDir)return res.status(400).json({error:'Confirm installation of the last compiled map first.'});
 try{
  const resourceRoots=await validateExternalRoots(req.body?.resourceRoots||last.resourceRoots||[]);
  const result=await writeDistribution({gameDir:last.gameDir,mapName:last.mapName,destinationDir:last.gameDir,format:'install',resourceRoots,gameProfile:last.gameProfile||'svengine',
    compiledBspPath:last.file,inlineBinaryFiles:last.inlineBinaryFiles||[]});
  return res.json({installed:true,destination:result.destination,files:result.files});
 }catch(error){return res.status(400).json({error:`Installation rejected: ${error.message||error}`})}
});
app.post('/api/compile/open-output',async(req,res)=>{
 const last=lastCompiledOutput;
 if(!last||req.body?.mapName!==last.mapName||req.body?.gameDir!==last.gameDir)
   return res.status(400).json({error:'No matching compiled output in this session.'});
 const folder=last.destination;
 try{
  if(!(await isDir(folder)))throw Error('Output folder is missing.');
  if(process.platform==='win32'){
   const child=spawn('explorer.exe',[folder],{detached:true,stdio:'ignore',windowsHide:true});
   child.on('error',()=>{});child.unref();
   return res.json({opened:true,destination:folder});
  }
  return res.json({opened:false,destination:folder});
 }catch(error){return res.status(400).json({error:String(error.message||error)})}
});
// Sven Co-op-only FGD discovery (user-selected game directory, localhost API).
app.post('/api/svengine/fgd',async(req,res)=>{
  const gameDir=req.body?.gameDir;
  if(typeof gameDir!=='string'||gameDir.length>1024||!(await isDir(gameDir)))
    return res.status(400).json({error:'Configure the Sven Co-op game directory first.'});
  const candidates=[path.join(gameDir,'sven-coop.fgd'),path.resolve(gameDir,'..','svencoop','sven-coop.fgd')];
  const file=candidates.find(existsSync);
  if(!file)return res.status(404).json({error:'sven-coop.fgd not found. Use Import .FGD to select it manually.'});
  try{
    // Resolve local @include files for inherited FGD classes. Only FGD files
    // inside the chosen game directory are read; includes cannot traverse out.
    const root=path.resolve(path.dirname(file));const visited=new Set();
    const load=async(name,depth=0)=>{
      const resolved=path.resolve(root,name);
      if(depth>8||!resolved.toLowerCase().endsWith('.fgd')||
         !(resolved===root||resolved.startsWith(root+path.sep))||visited.has(resolved))return '';
      visited.add(resolved);
      const content=await fs.readFile(resolved,'utf8');
      const included=[...content.matchAll(/^\s*@include\s+"([^"]+\.fgd)"/gim)];
      let prefix='';
      for(const match of included){try{prefix+=await load(match[1],depth+1)+'\n'}catch{/* optional include not installed */}}
      return prefix+content.replace(/^\s*@include\s+"[^"]+"/gim,'');
    };
    return res.type('text/plain; charset=utf-8').send(await load(path.basename(file)));
  }catch(error){return res.status(500).json({error:`Cannot read Sven Co-op FGD: ${String(error)}`})}
});
// CS 1.6 FGD: prefer the user's legitimate local file; provide an explicitly
// limited editor-owned fallback when the game installation has no FGD.
app.post('/api/cs16/fgd',async(req,res)=>{
 try{
  const dir=req.body?.gameDir;
  const {contents,source}=await loadCS16Fgd(dir,projectPath('server','cs16-basic.fgd'));
  return res.set('X-FGD-Source',source).type('text/plain; charset=utf-8').send(contents);
 }catch(error){return res.status(400).json({error:String(error.message||error)});}
});
// Read only the fixed engine resource decals.wad, never a client-provided file name.
app.post('/api/assets/decals',async(req,res)=>{
  const gameDir=req.body?.gameDir;
  if(typeof gameDir!=='string'||gameDir.length>1024||!(await isDir(gameDir)))
    return res.status(400).json({error:'Configure the local Sven Co-op game directory first.'});
  const candidates=[path.join(gameDir,'decals.wad'),path.join(gameDir,'..','svencoop','decals.wad'),...(path.basename(path.resolve(gameDir)).toLowerCase()==='cstrike'?[path.join(gameDir,'..','valve','decals.wad')]:[])];
  try{
    const file=candidates.find(existsSync);
    if(!file)return res.status(404).json({error:'decals.wad not found. Import the game file manually.'});
    const stat=await fs.stat(file);
    if(!stat.isFile()||stat.size<12||stat.size>32*1024*1024)
      return res.status(400).json({error:'Invalid or oversized decals.wad (maximum 32 MB).'});
    const bytes=await fs.readFile(file);
    if(bytes.subarray(0,4).toString('ascii')!=='WAD3')return res.status(400).json({error:'decals.wad is not WAD3.'});
    return res.setHeader('Cache-Control','no-store').type('application/octet-stream').send(bytes);
  }catch(error){return res.status(500).json({error:`Cannot read decals.wad: ${String(error)}`})}
});
// Test in game: start the installed game on an already installed map (fixed executables only).
app.post('/api/game/launch',async(req,res)=>{
  try{return res.json(await launchGame({gameProfile:req.body?.gameProfile,gameDir:req.body?.gameDir,mapName:req.body?.mapName}));}
  catch(error){return res.status(400).json({error:String(error?.message||error)})}
});
// Home screen: original game icon from the user's own installation (read-only, PNG in memory).
app.get('/api/assets/game-icon',async(req,res)=>{
  try{
    const png=await gameIconPng(String(req.query.game||''),String(req.query.gameDir||''));
    if(!png)return res.status(404).set('Cache-Control','no-store').json({error:'Game not installed.'});
    return res.set('Cache-Control','private, max-age=86400').type('image/png').send(png);
  }catch(error){return res.status(400).json({error:String(error?.message||error)})}
});
// Read-only asset access restricted to Sven Co-op's model directories.
app.post('/api/assets/models',async(req,res)=>{
  try{return res.json(await listModels(req.body?.gameDir,req.body?.query||'',req.body?.limit,{refresh:req.body?.refresh===true}));}
  catch(error){return res.status(400).json({error:String(error?.message||error)});}
});
app.post('/api/assets/model',async(req,res)=>{
  try{
    const data=await openModel(req.body?.gameDir,req.body?.source,req.body?.path);
    res.setHeader('Cache-Control','private, max-age=300');
    return res.type('application/octet-stream').send(data);
  }catch(error){
    // Optional probes (texture companions T.mdl, animation groups 01.mdl…) search folder by folder:
    // a file that is simply not in this folder is "no content", not a failed request.
    if(req.body?.optional===true&&(error?.code==='ENOENT'||/Invalid model source/.test(String(error?.message))))return res.status(204).end();
    return res.status(400).json({error:String(error?.message||error)});
  }
});
// Sven Co-op sound inventory and read-only local preview (no uploads or mutations).
app.post('/api/assets/sounds',async(req,res)=>{
  try{return res.json(await listSounds(req.body?.gameDir,req.body?.query||'',req.body?.limit,{refresh:req.body?.refresh===true}));}
  catch(error){return res.status(400).json({error:String(error?.message||error)});}
});
app.get('/api/assets/sound',streamSound);
app.post('/api/assets/sound-diagnostic',async(req,res)=>{
  try{return res.json(await inspectSoundReference(req.body?.gameDir,req.body?.path))}
  catch(error){return res.status(400).json({error:String(error?.message||error)})}
});
// Read-only sky catalogue. Existing game textures remain on the user's PC.
app.post('/api/assets/skies',async(req,res)=>{
  try{return res.json({items:await listSkies(req.body?.gameDir)})}
  catch(error){return res.status(400).json({error:String(error?.message||error)})}
});
app.get('/api/assets/sky-face',async(req,res)=>{
  try{
    const {buffer,mime}=await skyFace(req.query?.gameDir,req.query?.source,req.query?.sky,req.query?.side);
    return res.setHeader('Cache-Control','private, max-age=3600').type(mime).send(buffer);
  }catch(error){return res.status(400).json({error:String(error?.message||error)})}
});
// BSP Viewer only: find missing WAD3 miptextures from local Sven Co-op overlays.
// Reads are bounded and confined to game/addon/downloads WAD files.
app.post('/api/bsp/wad-textures',async(req,res)=>{
  try{return res.json(await findBspWadTextures(req.body||{}));}
  catch(error){return res.status(400).json({error:String(error?.message||error)});}
});
app.post('/api/assets/converted-audio',express.raw({type:'audio/wav',limit:'39mb'}),installConvertedSound);
// Optional external decompiler: explicit user action only. Does not modify installed maps.
// Requires the user's own surfdecomp.exe; we do not distribute that binary.
app.post('/api/bsp/decompile-map',express.raw({type:'application/octet-stream',limit:'256mb'}),async(req,res)=>{
  try{
    if(!Buffer.isBuffer(req.body))return res.status(400).json({error:'Expected binary BSP upload.'});
    const toolPath=decodeURIComponent(String(req.headers['x-sven-decompiler']||''));
    const job=new AbortController();
    // When a user cancels a long geometry recovery, stop SurfDecomp as well.
    const onDisconnect=()=>{if(!res.writableEnded)job.abort()};
    res.once('close',onDisconnect);
    let result;
    try{result=await decompileBspToMap({bsp:req.body,toolPath,signal:job.signal})}
    finally{res.off('close',onDisconnect)}
    res.setHeader('Cache-Control','no-store');
    return res.json(result);
  }catch(error){return res.status(400).json({error:String(error?.message||error)});}
});
// An explicit user action installs the companion WAD for a BSP prefab.
// Raw bytes (not arbitrary server paths); only a validated game overlay is writable.
app.post('/api/prefab-wad/install',express.raw({type:'application/octet-stream',limit:'24mb'}),async(req,res)=>{
  try{
    const encoded=String(req.headers['x-sven-game-dir']||'');
    if(encoded.length>3072)throw Error('Invalid game directory.');
    const gameDir=decodeURIComponent(encoded),name=req.headers['x-sven-wad-name'];
    const result=await installPrefabWad(gameDir,name,req.body);
    return res.json(result);
  }catch(error){return res.status(400).json({error:String(error?.message||error)})}
});

// Builds are staged in the OS temp folder and copied to Documents/Builds or the chosen output.
// Remove stale staging folders (e.g. after a crash) when the service starts.
const BUILD_ROOT=path.join(os.tmpdir(),'svenstudio-builds');
const removeBuildDir=dir=>dir&&path.dirname(dir)===BUILD_ROOT?fs.rm(dir,{recursive:true,force:true}).catch(()=>{}):Promise.resolve();
(async()=>{try{const cutoff=Date.now()-24*3600*1000;for(const name of await fs.readdir(BUILD_ROOT)){const dir=path.join(BUILD_ROOT,name);const stat=await fs.stat(dir).catch(()=>null);if(stat?.isDirectory()&&stat.mtimeMs<cutoff)await removeBuildDir(dir);}}catch{/* no staging folder yet */}})();
// The lock is taken before any await so two requests can never start two builds.
let compileStarting=false;
app.post('/api/compile',async(req,res)=>{
  if(active||compileStarting)return res.status(409).json({error:'Another compile is already running.'});
  compileStarting=true;
  try{await compileRequest(req,res);}finally{compileStarting=false;}
});
async function compileRequest(req,res){
  if(active)return res.status(409).json({error:'Another compile is already running.'});
  const {mapName:requestedMapName,mapData,compilerDir,gameDir,wadPaths,buildQuality='final',overview=null,fullVis:fullVisRequest=true,extraRad:extraRadRequest=true,radAmbientTest='off',previewOnly=false,gameProfile='svengine',compilerEngine='sc',sdhltDir='',sdhltAO=false,sdhltPCF='off',smartWadMode='off',smartWadName='',browserWads=[],distributionDir='',distributionFormat='off',resourceRoots=[]}=req.body||{};
  if(!['svengine','cs16'].includes(gameProfile))return res.status(400).json({error:'Unknown target game profile.'});
  if(gameProfile==='cs16'&&(compilerEngine!=='zhlt'||radAmbientTest!=='off'))return res.status(400).json({error:'CS 1.6 requires the ZHLT compilers and does not use the Svengine SC-RAD lighting test.'});
  if(gameProfile==='svengine'&&compilerEngine==='zhlt')return res.status(400).json({error:'ZHLT compilers are available only for CS 1.6 builds.'});
  if(previewOnly!==false&&!isPreviewCompile(previewOnly))return res.status(400).json({error:'Invalid previewOnly flag.'});
  // Build quality: final = -full VIS + -extra RAD; fast = normal VIS/RAD; geometry = CSG+BSP only (no lighting).
  // A lighting preview always needs RAD, so it never runs as geometry-only.
  if(!['final','fast','geometry'].includes(buildQuality))return res.status(400).json({error:'Invalid build quality.'});
  const quality=previewOnly&&buildQuality==='geometry'?'fast':buildQuality;
  const fullVis=quality==='final'?fullVisRequest!==false:false,extraRad=quality==='final'?extraRadRequest!==false:false;
  const runStages=quality==='geometry'?stages.slice(0,2):stages;
  if(!['off','embed','external'].includes(smartWadMode))return res.status(400).json({error:'Invalid Smart WAD mode.'});
  if(smartWadMode!=='off'){try{smartWadFilename(smartWadName,'validation','123456789abc')}catch(error){return res.status(400).json({error:error.message})}}
  if(!['off','build','folder','folder_zip','install'].includes(distributionFormat)||typeof distributionDir!=='string'||distributionDir.length>1024)return res.status(400).json({error:'Invalid distribution settings.'});
  let externalRoots;try{externalRoots=await validateExternalRoots(resourceRoots)}catch(error){return res.status(400).json({error:String(error.message||error)})}
  const outputMode=compileOutputMode(distributionFormat);
  if(!previewOnly&&['folder','folder_zip'].includes(outputMode)){try{await validateBuildDestination(distributionDir||await studioDirectory('builds',true),gameDir)}catch(error){return res.status(400).json({error:String(error.message||error)})}}
  let plan;
  try{plan=lightTestSettings(requestedMapName,radAmbientTest);}catch(error){return res.status(400).json({error:String(error.message||error)});}
  let {name:mapName,ambient:lightAmbient}=plan;
  if(!validMapName(mapName)||typeof mapData!=='string'||mapData.length<40||mapData.length>20_000_000)
    return res.status(400).json({error:'Invalid map name or source.'});
  if(!await isDir(gameDir))return res.status(400).json({error:'Game directory must exist on this PC.'});
  if(gameProfile==='cs16'&&!await isCS16GameDirectory(gameDir))return res.status(400).json({error:'Select your installed Counter-Strike 1.6 cstrike folder.'});
  let profile;
  try{profile=resolveCompilerProfile({compilerEngine,compilerDir,sdhltDir,sdhltAO,sdhltPCF});}
  catch(error){return res.status(400).json({error:error.message});}
  if(!await isDir(profile.dir))return res.status(400).json({error:'Selected compiler directory does not exist.'});
  if(profile.engine==='sdhlt'){
    const userWadList=Array.isArray(wadPaths)?wadPaths:[];
    const hasCustomWad=userWadList.some(entry=>typeof entry==='string'&&path.win32.basename(entry.replaceAll('\\','/')).toLowerCase()==='sdhlt.wad'&&existsSync(entry));
    if(!existsSync(profile.requiredWad)&&!hasCustomWad)
      return res.status(400).json({error:'SDHLT requires sdhlt.wad. Place it beside the SDHLT compilers or add its full path under WAD paths.'});
    // Distinct map name: an experimental compiler must never overwrite the SC BSP.
    mapName=`${mapName}_sdhlt`;
    if(!validMapName(mapName))return res.status(400).json({error:'Map name too long for the SDHLT output suffix.'});
  }
  const executables=profile.executablePaths;
  // Only a user-selected local compiler is executed; service listens on loopback only.
  // Every compile gets an isolated directory. Never reuse .bsp/.p0/.prt from older builds.
  const workRoot=BUILD_ROOT;
  let workDir;
  try{await fs.mkdir(workRoot,{recursive:true});workDir=await fs.mkdtemp(path.join(workRoot,`${mapName}-`));}
  catch(e){return res.status(500).json({error:`Cannot create build folder: ${e.message}`});}
  const mapBase=path.join(workDir,mapName);
  const builtInWad=projectPath('public','svstudio.wad');
  let source=mapData, wadPlan, smartPlan=null,smartExternalPath=null;const stagedExtras=[];
  try{
    // The browser may hold an imported prefab WAD in IndexedDB without a matching
    // disk file. Save it ONLY into this isolated temporary build directory.
    const injectedWads=[];
    if(smartWadMode!=='off'){
      if(!Array.isArray(browserWads)||browserWads.length>20)throw Error('Too many browser WADs for one build.');
      let total=0;const names=new Set();
      for(const wad of browserWads){
        if(typeof wad?.name!=='string'||!(/^[a-z0-9_.+~()-]{1,100}\.wad$/i.test(wad.name))||typeof wad.base64!=='string'||wad.base64.length>18_000_000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(wad.base64))throw Error('Invalid browser WAD payload.');
        const key=wad.name.toLowerCase();if(names.has(key))throw Error(`Duplicate browser WAD name: ${wad.name}`);names.add(key);
        const bytes=Buffer.from(wad.base64,'base64');total+=bytes.length;
        if(total>20*1024*1024||bytes.length<12||bytes.toString('ascii',0,4)!=='WAD3')throw Error(`Browser WAD exceeds safety limits or is not WAD3: ${wad.name}`);
        // Never shadow a different WAD already installed in the game or
        // explicitly configured by the user. Preview may have a stale version.
        const configured=Array.isArray(wadPaths)?wadPaths:[];
        const gameRoot=['svencoop','svencoop_addon','svencoop_downloads','cstrike'].includes(path.basename(path.resolve(gameDir)).toLowerCase())?path.dirname(path.resolve(gameDir)):path.resolve(gameDir);
        const candidates=[...configured.filter(p=>typeof p==='string'&&path.win32.basename(p.replaceAll('\\','/')).toLowerCase()===key),
          ...(gameProfile==='cs16'?['cstrike','valve']:['svencoop','svencoop_addon','svencoop_downloads']).map(layer=>path.join(gameRoot,layer,wad.name))];
        for(const candidate of candidates){
          if(existsSync(candidate)&&!(await fs.readFile(candidate)).equals(bytes))throw Error(`WAD conflict: ${wad.name} differs between the browser and disk. Resolve it in the prefab resources before compiling.`);
        }
        const dir=path.join(workDir,'browser-wads');await fs.mkdir(dir,{recursive:true});
        const file=path.join(dir,wad.name);await fs.writeFile(file,bytes,{flag:'wx'});injectedWads.push(file);
      }
    }
    wadPlan=await prepareCompileWads(source,{gameDir,gameProfile,compilerDir:profile.dir,builtInWad,configuredWadPaths:[...(Array.isArray(wadPaths)?wadPaths:[]),...externalWadSearchFolders(externalRoots),...injectedWads,...(profile.engine==='sdhlt'&&existsSync(profile.requiredWad)?[profile.requiredWad]:[])]});
    source=wadPlan.map;
    if(wadPlan.missingWads.length&&smartWadMode==='off'){
      throw new Error(`Missing WAD files: ${wadPlan.missingWads.join(', ')}. Set full local WAD paths in Settings (WAD paths) or install the WAD files in svencoop_addon/ or svencoop/. The compiler must be able to read the WAD files. The project and its textures were not modified.`);
    }
    if(smartWadMode!=='off'){
      smartPlan=await planSmartWadBuild(source,wadPlan.resolvedWadList,{workDir,mapName,mode:smartWadMode,wadName:smartWadName});
      source=smartPlan.map;
      if(smartPlan.mode==='external'){
        await assertNoInstalledWadCollision(smartPlan,gameDir);
        // Compiler reads the temporary WAD. Never install anything in the game
        // unless the user explicitly selected the installation output mode.
        stagedExtras.push({path:smartPlan.basename,bytes:smartPlan.buffer});
      }
    }
    if(!previewOnly&&!smartPlan&&wadPlan.wadList.some(x=>path.win32.basename(x.replaceAll('\\','/')).toLowerCase()==='svstudio.wad')&&existsSync(builtInWad)){
      stagedExtras.push({path:'svstudio.wad',bytes:await fs.readFile(builtInWad)});
    }
    // HF10: no game writes here. Source textures, bundled WAD and demo sounds
    // are compiler inputs only; runtime resources must be packaged explicitly.
    // CS 1.6 spectator overview generated by the editor: fixed names, 8-bit 1024x768 BMP + small TXT.
    if(overview&&!previewOnly){
      if(gameProfile!=='cs16')throw Error('Overviews are generated only for Counter-Strike 1.6.');
      const bmp=typeof overview.bmpBase64==='string'&&overview.bmpBase64.length<1_500_000?Buffer.from(overview.bmpBase64,'base64'):null;
      if(!bmp||bmp.length<1078||bmp.toString('ascii',0,2)!=='BM'||bmp.readInt32LE(18)!==1024||bmp.readInt32LE(22)!==768||bmp.readUInt16LE(28)!==8)throw Error('Invalid overview image (expected 8-bit 1024x768 BMP).');
      if(typeof overview.txt!=='string'||overview.txt.length>4096||!overview.txt.includes(`overviews/${mapName}.bmp`))throw Error('Invalid overview description.');
      stagedExtras.push({path:`overviews/${mapName}.bmp`,bytes:bmp},{path:`overviews/${mapName}.txt`,bytes:Buffer.from(overview.txt,'utf8')});
    }
    for(const sample of ['studio_hum.wav','studio_chime.wav']){
      if(previewOnly||!source.includes(`"message" "svstudio/${sample}"`))continue;
      const bundled=projectPath('public','starter-sounds','svstudio',sample);
      if(existsSync(bundled))stagedExtras.push({path:`sound/svstudio/${sample}`,bytes:await fs.readFile(bundled)});
    }
  await fs.writeFile(`${mapBase}.map`,source,'utf8');
  }catch(e){void removeBuildDir(workDir);return res.status(500).json({error:`Cannot prepare build files: ${e.message}`});}
  res.status(200);res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control','no-cache');res.setHeader('X-Accel-Buffering','no');
  active={child:null,cancelled:false};const task=active;
  // Closing the tab or losing the connection stops the compiler instead of leaving it running.
  res.on('close',()=>{if(!res.writableEnded&&active===task)cancelTask(task);});
  let keepWorkDir=false;
  const buildLogLines=[];
  // Keep a capped, self-contained log for the isolated output.
  const logBuild=(line)=>{if(buildLogLines.length<12000)buildLogLines.push(line)};
  send(res,'info',`Working directory: ${workDir}`);
  send(res,'info',`Target game: ${gameProfile==='cs16'?'Counter-Strike 1.6':'Sven Co-op'}; compiler: ${profile.engine==='sc'?'Sven Co-op SDK':profile.engine==='zhlt'?'ZHLT GoldSrc':'SDHLT (experimental)'}; selected directory: ${profile.dir}`);
  if(profile.engine==='sdhlt')send(res,'warning','SDHLT targets Half-Life GoldSrc. Compiled maps must be checked in Sven Co-op; use the SC toolchain if SDHLT fails or produces incompatible BSPs.');
  if(lightAmbient!==null)send(res,'warning',`SC-RAD LIGHT TEST ONLY: -ambient ${lightAmbient} ${lightAmbient} ${lightAmbient}. Output ${mapName}.bsp; base BSP ${requestedMapName}.bsp remains untouched. Lighting is diagnostic, not a restoration of original lightmaps.`);
  send(res,'info',`MAP SHA-256: ${createHash('sha256').update(source).digest('hex')}`);
  send(res,'info',`Resolved WADs used for THIS build: ${wadPlan.resolvedWadList.join('; ')||'(none)'}`);
  if(smartPlan?.toolResolved?.length)send(res,'info',`Compiler tool materials (${smartPlan.toolResolved.join(', ')}) selected from a trusted WAD source; cosmetic name differences do not block this build.`);
  if(smartPlan)send(res,'info',`Smart WAD (${smartPlan.mode}): ${smartPlan.textureCount} textures (${smartPlan.extraFrames} extra animation frames), ${smartPlan.sourceCount} source WADs → ${smartPlan.basename}. SHA-256 prefix ${smartPlan.hash}; original WADs unchanged.`);
  if(smartPlan?.mode==='external')send(res,'info',`External Smart WAD staged in isolated compiler workspace: ${smartPlan.basename}. No game files touched.`);
  for(const warning of wadPlan.warnings)send(res,'warning',`WAD/SKY: ${warning}`);
  if(Array.isArray(wadPaths))send(res,'info',`WAD search paths: ${wadPaths.join(';')}`);
  let leakSent=false;
  const sendLeak=async()=>{
    if(leakSent)return;
    const trace=await readBuildLeakPointfile(mapBase);
    if(!trace)return;
    leakSent=true;
    send(res,'diagnostic',`Compiler pointfile ${mapName}${trace.extension} loaded (${trace.points.length} points).`,{kind:'leak',stage:'BSP',points:trace.points});
  };
  try{
    if(quality!=='final')send(res,'info',quality==='geometry'?'Geometry-only build: SC/ZHLT CSG + BSP (no VIS/RAD). The map loads without lighting; use it to check shapes and leaks.':'Fast build: normal VIS and RAD (no -full / -extra).');
    for(let i=0;i<runStages.length;i++){
      if(task.cancelled)throw new Error('Build cancelled by user.');
      const stage=stages[i];
      const args=[...(stage==='CSG'&&smartPlan?smartPlan.csgArgs:[])];
      const flags=[...(stage==='VIS'&&fullVis?['-full']:[]),...(stage==='RAD'&&extraRad?['-extra']:[])];
      if(profile.engine==='zhlt')args.push(...flags,mapBase);
      else args.push(mapBase,...flags); // preserve SC/SDHLT argument ordering
      if(stage==='RAD'){args.push(...lightTestRadArgs(lightAmbient));args.push(...profile.radArgs);}
      send(res,'stage',`Starting ${profile.engine==='sc'?'SC':profile.engine==='zhlt'?'ZHLT':'SDHLT'}-${stage}...`,{stage});
      let illegalBrush=false,corruptLeafMapping=false;
      // v2.6: some SDHLT builds fail 'fixprt' with 'Corrupted leaf mapping'; VIS then works with -nofixprt.
      const runStage=(stageArgs)=>new Promise((resolve,reject)=>{
        const child=spawn(executables[i],stageArgs,{cwd:workDir,windowsHide:true,stdio:['ignore','pipe','pipe']});
        task.child=child;
        const push=stream=>{
          let pending='';
          stream.on('data',chunk=>{
            pending+=chunk.toString();const lines=pending.split(/\r?\n/);pending=lines.pop()??'';
            for(const line of lines)if(line.trim()){
              if(stage==='CSG'&&/Illegal Brush|plane with no normal|has a coplanar plane/i.test(line))illegalBrush=true;
              if(stage==='VIS'&&/Corrupted leaf mapping/i.test(line))corruptLeafMapping=true;
              logBuild(`[${stage}] ${line}`);send(res,'log',line);
            }
          });
          stream.on('end',()=>{if(pending.trim()){logBuild(`[${stage}] ${pending}`);send(res,'log',pending)}});
        };
        push(child.stdout);push(child.stderr);
        child.on('error',reject);
        child.on('close',code=>{
          task.child=null;
          if(task.cancelled)reject(new Error('Build cancelled by user.'));
          else if(code===0)resolve();else reject(new Error(`${stage} exited with code ${code}. Check log for leaks or invalid brushes.`));
        });
      });
      try{await runStage(args);}
      catch(error){
        if(!(stage==='VIS'&&corruptLeafMapping&&profile.engine!=='zhlt'&&!args.includes('-nofixprt')))throw error;
        send(res,'info','VIS: the portal file could not be fixed (Corrupted leaf mapping). Retrying VIS with -nofixprt...');
        await runStage(['-nofixprt',...args]);
      }
      if(stage==='CSG'&&illegalBrush){
        throw new Error('CSG detected an invalid brush. Build stopped before BSP. Check brush face winding/planarity in your MAP source.');
      }
      send(res,'stage',`${profile.engine==='sc'?'SC':profile.engine==='zhlt'?'ZHLT':'SDHLT'}-${stage} finished successfully.`,{stage});
      if(stage==='BSP')await sendLeak();
    }
    if(!existsSync(`${mapBase}.bsp`))throw new Error('Compilers finished but did not create a .bsp file.');
    // Audit the produced BSP, not only the editable MAP. This is a structural
    // check, not proof that the client's GL renderer loads a skybox correctly.
    try{
      const audit=await inspectBspFile(`${mapBase}.bsp`);
      send(res,'info',`BSP SKY audit: skyname=${audit.skyname||'(unset)'}, SKY faces=${audit.skyFaces}, special=${audit.skySpecialFaces}, CONTENTS_SKY leaves=${audit.skyLeaves}, SKY lightmapped=${audit.lightmappedSkyFaces}`);
      send(res,'info',`BSP embedded WAD references: ${audit.worldWads.join('; ')||'(none)'}`);
      for(const warning of audit.warnings)send(res,'warning',warning);
      // Engine capacity: real counts from the compiled BSP. Warn from 85% on classic GoldSrc (CS 1.6).
      const limits=bspLimitReport(audit.counts);
      send(res,'info',`BSP size: ${limits.slice(0,6).map(l=>`${l.name} ${l.count}`).join(', ')}.`);
      if(gameProfile==='cs16')for(const l of limits.filter(l=>l.percent>=85))send(res,'warning',`BSP limit: ${l.name} ${l.count}/${l.max} (${l.percent}%). Classic GoldSrc may fail to load or compile the map beyond 100%.`);
      const plannedWads=smartPlan?[smartPlan.basename.toLowerCase()]:[...new Set(wadPlan.wadList.map(x=>path.win32.basename(x.replaceAll('\\','/')).toLowerCase()))];
      const extras=audit.worldWads.filter(x=>!plannedWads.includes(x));
      if(extras.length)send(res,'warning',`BSP contains WAD references not present in the prepared MAP: ${extras.join('; ')}. Inspect compiler configuration and source MAP.`);
      if(wadPlan.usesSky&&audit.skyFaces===0)throw new Error('SKY exists in MAP but no SKY faces survived SC-CSG/BSP. Verify SKY brushes and compiler options.');
    }catch(e){
      if(e.message.includes('SKY exists in MAP'))throw e;
      send(res,'warning',`BSP SKY audit unavailable: ${e.message}`);
    }
    if(previewOnly){
      const compiled=path.join(workDir,`${mapName}.bsp`);
      const stat=await fs.stat(compiled);
      const previousPreview=lastLightingPreview;
      lastLightingPreview=createLightingPreviewRecord(compiled,stat.size);keepWorkDir=true;
      if(previousPreview?.file)void removeBuildDir(path.dirname(previousPreview.file));
      send(res,'complete',`${profile.engine==='sc'?'SC-RAD':'SDHLT RAD'} preview ready: ${mapName}.bsp (not installed in the game).`,{previewId:lastLightingPreview.id});
      return;
    }
    // Make runtime WAD reference portable; the compiler-only absolute temp
    // path must not leak into the delivered BSP.
    const compiledBsp=`${mapBase}.bsp`;
    if(smartPlan){
      const bytes=await fs.readFile(compiledBsp);
      await fs.writeFile(compiledBsp,makePortableBsp(bytes,smartPlan.mode==='external'?smartPlan.basename:''));
    }
    let saved;
    const originalMapPath=path.join(workDir,`${mapName}_source.map`);
    await fs.writeFile(originalMapPath,mapData,'utf8');
    const compiledLog=buildLogLines.join('\n')+'\n';
    if(outputMode==='install'){
      // Installation is the ONLY mode authorized to modify Sven Co-op.
      const installed=await writeDistribution({gameDir,mapName,destinationDir:gameDir,format:'install',resourceRoots:externalRoots,gameProfile,
        compiledBspPath:compiledBsp,inlineBinaryFiles:stagedExtras,manualPaths:smartPlan?.mode==='external'?[smartPlan.basename]:[]});
      saved={destination:installed.destination,output:path.join(installed.destination,'maps',`${mapName}.bsp`),files:installed.files,missing:0};
      send(res,'info',`Explicit installation completed in ${saved.destination}.`);
    }else{
      const target=outputMode==='build'?null:distributionDir||await studioDirectory('builds',true);
      try{
        saved=await writeIsolatedBuild({gameDir,mapName,compiledBspPath:compiledBsp,sourceMapPath:originalMapPath,buildLog:compiledLog,
          destinationDir:target,format:outputMode,resourceRoots:externalRoots,inlineBinaryFiles:stagedExtras,
          gameProfile,writeDistribution:options=>writeDistribution({...options,gameProfile})});
        send(res,'info',`Isolated output created in ${saved.destination}. ${gameProfile==='cs16'?'Counter-Strike 1.6':'Sven Co-op'} files were not modified.`);
        for(const warning of (saved.warnings||[]).slice(0,8))send(res,'warning',`Packaging: ${warning}`);
      }catch(packageError){
        send(res,'warning',`Full package unavailable: ${packageError.message||String(packageError)}. Preserving compiled BSP and available generated WAD in isolated output.`);
        saved=await writeIsolatedBuild({gameDir,mapName,compiledBspPath:compiledBsp,sourceMapPath:originalMapPath,buildLog:compiledLog,
          destinationDir:target,format:'build',resourceRoots:externalRoots,inlineBinaryFiles:stagedExtras,gameProfile});
      }
    }
    lastCompiledOutput={mapName,gameProfile,gameDir:path.resolve(gameDir),file:saved.output,destination:saved.destination,resourceRoots:externalRoots,inlineBinaryFiles:stagedExtras};
    send(res,'package',`Build saved: ${saved.destination}`,{destination:saved.destination,files:saved.files});
    send(res,'complete',`BSP compiled: ${saved.output}`,{output:saved.output,installed:outputMode==='install'});
  }catch(e){
    try{await sendLeak()}catch{/* diagnostic is best-effort; preserve the compiler error */}
    send(res,'error',e.message||String(e));
  }
  finally{active=null;res.end();if(!keepWorkDir)void removeBuildDir(workDir);}
}
// Preferences shared by the browser version and the desktop app (Documents/SvenStudio3D/settings.json).
app.get('/api/shared-settings',async(_req,res)=>{try{return res.json(await readSharedSettings()??{version:1,revision:0,values:{}});}catch(error){return res.status(500).json({error:String(error?.message||error)});}});
app.put('/api/shared-settings',async(req,res)=>{try{return res.json(await writeSharedSettings(req.body));}catch(error){return res.status(400).json({error:String(error?.message||error)});}});
// Desktop app (Electron): serve the compiled UI (dist/) from this same local origin, so the
// window, the API and the guard all use http://127.0.0.1:<PORT>. The browser version keeps using Vite.
const SERVED_DIST=process.env.SVEN_SERVE_DIST==='1'?projectPath('dist'):null;
if(SERVED_DIST&&existsSync(projectPath('dist','index.html'))){
  app.use(express.static(SERVED_DIST,{index:false,maxAge:'1h'}));
  app.get(/^(?!\/api\/).*/,(_req,res)=>res.sendFile(projectPath('dist','index.html')));
}
export const serverReady=new Promise((resolve,reject)=>{
  const server=app.listen(PORT,'127.0.0.1',()=>{console.log(`Sven Studio compiler service running on http://127.0.0.1:${PORT}`);resolve(server);});
  server.on('error',reject);
});
// Plain `node server/index.js` must still exit loudly if the port is taken.
if(!process.versions.electron)serverReady.catch(error=>{console.error(error);process.exit(1);});

// Dedicated authenticated collaboration port: no filesystem/compilation API exposed.
attachBuildTogether(app,{port:Number(process.env.SVEN_BUILDTOGETHER_PORT||49178)});
