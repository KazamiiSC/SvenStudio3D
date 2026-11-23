/** HF14: non-destructive, local project checkpoints.
 * Only Documentos/SvenStudio3D/Projects/History may be written.
 * Every snapshot is an immutable gzip plus a small metadata sidecar.
 * Manual/safety snapshots are NEVER pruned; automatic snapshots keep the last 20
 * per project name. No installed game/SDK path is accepted here.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {gzip,gunzip} from 'node:zlib';
import {promisify} from 'node:util';
import {studioDirectory} from './studioDocuments.js';
const gzipAsync=promisify(gzip),gunzipAsync=promisify(gunzip);
const ID=/^[a-z0-9]{8,16}-[a-f0-9]{16}$/;
const MAX_SOURCE=64*1024*1024;
const MAX_AUTO=20;
const HASH=buffer=>createHash('sha256').update(buffer).digest('hex');
const fail=message=>{throw Error(message)};
export async function historyDirectory({root=null,create=false}={}){
 const projects=await studioDirectory('projects',create,root);
 const folder=path.join(projects,'History');
 if(create)await fs.mkdir(folder,{recursive:true});
 try{const stat=await fs.lstat(folder);if(!stat.isDirectory()||stat.isSymbolicLink())fail('Unsafe History directory.');}
 catch(error){if(error.code!=='ENOENT')throw error;}
 return folder;
}
function validProject(project){
 return project&&typeof project==='object'&&project.version===1&&
 (project.target===undefined||project.target==='svengine'||project.target==='cs16')&&
 typeof project.name==='string'&&project.name.length>0&&project.name.length<=512&&
 Array.isArray(project.objects)&&project.objects.length<=100000&&
 project.world&&typeof project.world==='object'&&!Array.isArray(project.world)&&
 Array.isArray(project.wadNames)&&project.wadNames.length<=4096;
}
function validMeta(m){return m&&m.schema==='svenstudio-history-v1'&&ID.test(m.id)&&
 Number.isFinite(m.createdAt)&&typeof m.projectName==='string'&&
 ['auto','manual','safety'].includes(m.kind)&&typeof m.label==='string'&&m.label.length<=120&&
 /^[a-f0-9]{64}$/.test(m.sha256)&&Number.isSafeInteger(m.bytes)&&m.bytes>0&&m.bytes<=MAX_SOURCE&&
 Number.isInteger(m.objects)&&m.objects>=0&&m.objects<=100000;}
async function readMeta(folder,file){
 try{
  const st=await fs.lstat(path.join(folder,file));if(!st.isFile()||st.size>4096)return null;
  const metadata=JSON.parse(await fs.readFile(path.join(folder,file),'utf8'));
  if(!validMeta(metadata)||file!==`${metadata.id}.meta.json`)return null;
  const dataStat=await fs.lstat(path.join(folder,`${metadata.id}.svhistory.gz`));
  if(!dataStat.isFile()||dataStat.size>MAX_SOURCE)return null;
  return metadata;
 }catch{return null;}
}
export async function listHistory({root=null,limit=200}={}){
 const folder=await historyDirectory({root});
 const entries=await fs.readdir(folder).catch(error=>error.code==='ENOENT'?[]:Promise.reject(error));
 const names=entries.filter(f=>ID.test(f.replace(/\.meta\.json$/,''))&&f.endsWith('.meta.json')).sort().reverse().slice(0,1500);
 const records=[];
 for(const name of names){const meta=await readMeta(folder,name);if(meta)records.push(meta);}
 return records.sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).slice(0,Math.min(500,Math.max(1,limit)));
}
export async function createHistorySnapshot({project,kind='manual',label=''},{root=null}={}){
 if(!['auto','manual','safety'].includes(kind))fail('Invalid checkpoint type.');
 if(typeof label!=='string'||label.length>120||/[\u0000-\u001f]/.test(label))fail('Invalid checkpoint label.');
 if(!validProject(project))fail('Invalid project structure. No checkpoint was saved.');
 const content=Buffer.from(JSON.stringify(project));
 if(content.length===0||content.length>MAX_SOURCE)fail('Project exceeds the 64 MB history safety limit.');
 const sha256=HASH(content);
 // Deduplicate consecutive autosaves of identical maps, even after restarts.
 if(kind==='auto'){
  const recent=await listHistory({root,limit:500});
  const matching=recent.find(m=>m.projectName===project.name);
  if(matching?.sha256===sha256)return {saved:false,deduplicated:true,entry:matching};
 }
 const folder=await historyDirectory({root,create:true});
 const id=`${Date.now().toString(36)}-${randomBytes(8).toString('hex')}`;
 const dataPath=path.join(folder,`${id}.svhistory.gz`);
 const metaPath=path.join(folder,`${id}.meta.json`);
 const entry={schema:'svenstudio-history-v1',id,createdAt:Date.now(),projectName:project.name,
  kind,label:label.trim(),objects:project.objects.length,
  brushes:project.objects.filter(o=>o.kind==='brush').length,
  entities:project.objects.filter(o=>o.kind==='entity').length,
  bytes:content.length,sha256};
 try{
  await fs.writeFile(dataPath,await gzipAsync(content,{level:6}),{flag:'wx'});
  await fs.writeFile(metaPath,JSON.stringify(entry),{flag:'wx'});
 }catch(error){
  // If metadata could not be committed, the orphan archive is not a valid checkpoint.
  await fs.rm(dataPath,{force:true}).catch(()=>{});
  throw error;
 }
 if(kind==='auto')await pruneOldAutos(project.name,{root}).catch(()=>{});
 return {saved:true,deduplicated:false,entry};
}
async function pruneOldAutos(projectName,{root=null}={}){
 const entries=(await listHistory({root,limit:500})).filter(e=>e.kind==='auto'&&e.projectName===projectName);
 const folder=await historyDirectory({root});
 for(const entry of entries.slice(MAX_AUTO)){
  // Automatic versions are the only snapshots that may expire.
  await fs.rm(path.join(folder,`${entry.id}.meta.json`),{force:true});
  await fs.rm(path.join(folder,`${entry.id}.svhistory.gz`),{force:true});
 }
}
export async function readHistorySnapshot(id,{root=null}={}){
 if(typeof id!=='string'||!ID.test(id))fail('Invalid checkpoint identifier.');
 const folder=await historyDirectory({root});
 const entry=await readMeta(folder,`${id}.meta.json`);
 if(!entry)fail('Checkpoint is missing or invalid.');
 const archive=await fs.readFile(path.join(folder,`${id}.svhistory.gz`));
 const data=await gunzipAsync(archive,{maxOutputLength:MAX_SOURCE});
 if(data.length!==entry.bytes||HASH(data)!==entry.sha256)fail('Checkpoint integrity verification failed.');
 const project=JSON.parse(data.toString('utf8'));
 if(!validProject(project)||project.name!==entry.projectName||project.objects.length!==entry.objects)
  fail('Checkpoint project structure is invalid.');
 return {entry,project};
}
