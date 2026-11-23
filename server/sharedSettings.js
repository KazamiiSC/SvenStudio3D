/** Preferences shared by the browser version and the desktop app (v2.4).
 * Both keep their own browser storage; this file in Documents/SvenStudio3D lets them agree:
 * build paths, language, layout, HUD, shortcuts, favourites… Never project data or backups.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {studioRoot} from './studioDocuments.js';

export const SHARED_SETTINGS_FILE='settings.json';
const KEY=/^(?:svenstudio|svstudio|sven-studio)[\w:.-]{0,80}$/;
const MAX_BYTES=2*1024*1024;

export function sanitizeSharedSettings(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid shared settings.');
  const revision=Number(input.revision);
  if(!Number.isFinite(revision)||revision<=0)throw Error('Invalid shared settings revision.');
  const values={};
  for(const [key,value] of Object.entries(input.values??{})){
    if(!KEY.test(key))continue;
    if(typeof value!=='string')continue; // only real values: a missing key never deletes the other side's
    values[key]=value;
  }
  const result={version:1,revision,values};
  if(Buffer.byteLength(JSON.stringify(result))>MAX_BYTES)throw Error('Shared settings are too large.');
  return result;
}

async function filePath(root){return path.join(root??await studioRoot(),SHARED_SETTINGS_FILE);}

export async function readSharedSettings(root){
  // Tolerate a UTF-8 BOM (e.g. the file was opened and saved in Notepad).
  try{return sanitizeSharedSettings(JSON.parse((await fs.readFile(await filePath(root),'utf8')).replace(/^\uFEFF/,'')));}
  catch(error){if(error.code==='ENOENT')return null;return null;}
}

/** Last writer wins, but never with an older revision than the one on disk. */
export async function writeSharedSettings(input,root){
  const next=sanitizeSharedSettings(input);
  const current=await readSharedSettings(root);
  if(current&&current.revision>next.revision)return {saved:false,current};
  const target=await filePath(root);
  await fs.mkdir(path.dirname(target),{recursive:true});
  const temp=`${target}.tmp`;
  await fs.writeFile(temp,JSON.stringify(next,null,1));
  await fs.rename(temp,target);
  return {saved:true,current:next};
}
