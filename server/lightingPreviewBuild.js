/** Ephemeral, read-only preview builds. Never take a user-selected output path. */
import {randomUUID} from 'node:crypto';

export const LIGHTING_PREVIEW_TTL_MS=20*60*1000;
export const LIGHTING_PREVIEW_MAX_BYTES=256*1024*1024;
const PREVIEW_ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const isLightingPreviewId=value=>typeof value==='string'&&PREVIEW_ID.test(value);
export const isPreviewCompile=value=>value===true;
export function createLightingPreviewRecord(file,size,createdAt=Date.now()){
  if(typeof file!=='string'||!file.toLowerCase().endsWith('.bsp'))throw Error('Invalid compiled BSP path.');
  if(!Number.isSafeInteger(size)||size<124||size>LIGHTING_PREVIEW_MAX_BYTES)throw Error('Compiled BSP is empty or larger than 256 MB.');
  return {id:randomUUID(),file,size,expiresAt:createdAt+LIGHTING_PREVIEW_TTL_MS};
}
export function lightingPreviewAvailable(record,id,now=Date.now()){
  return !!record&&isLightingPreviewId(id)&&record.id===id&&now<record.expiresAt;
}
