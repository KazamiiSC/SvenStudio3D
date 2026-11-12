/** BSP prefab WAD dependency handling shared by Studio and MAP import.
 * Browser previews and compiler files are deliberately separate resources.
 */
import type {TextureAsset} from './types';
import type {StudioPrefab} from './prefabStudioFolder';
import {validateBspObjectPrefab,decodePrefabWad,type BspObjectPrefab} from './bspObjectExtractor';
import {parseWad} from './wad';

export const wadBase=(name:string)=>name.replaceAll('\\','/').split('/').pop()?.toLowerCase()??'';
export function prefabMaterialNames(prefab:StudioPrefab):string[]{
 const names=new Map<string,string>();
 for(const obj of prefab.objects)if(obj.kind==='brush')for(const face of obj.faces){
   const name=face.texture.trim();if(name&&!names.has(name.toLowerCase()))names.set(name.toLowerCase(),name);
 }
 return [...names.values()].sort((a,b)=>a.localeCompare(b));
}
export type PrefabWadReport={filename:string|null;materials:string[];loaded:string[];missing:string[];collisions:string[];configuredPath:string|null;embedded:boolean};
export function prefabWadReport(prefab:StudioPrefab,assets:readonly TextureAsset[],wadPaths:string):PrefabWadReport{
 const materials=prefabMaterialNames(prefab);
 const isBsp=prefab.format==='svenstudio-bsp-object'&&!!prefab.wad?.base64;
 const filename=isBsp?prefab.wad!.filename:null;
 const desired=filename?wadBase(filename):'';
 const loaded=materials.filter(name=>assets.some(asset=>asset.name.toLowerCase()===name.toLowerCase()&&wadBase(asset.wad)===desired));
 const missing=materials.filter(name=>!loaded.includes(name));
 const collisions=materials.filter(name=>assets.some(asset=>asset.name.toLowerCase()===name.toLowerCase()&&(!desired||wadBase(asset.wad)!==desired)));
 const configuredPath=filename?wadPaths.split(/[\r\n]+/).map(s=>s.trim()).find(p=>wadBase(p)===desired)??null:null;
 return {filename,materials,loaded,missing,collisions,configuredPath,embedded:isBsp};
}
export function prefabWadFile(prefab:StudioPrefab):File{
 const checked=validateBspObjectPrefab(prefab);
 return new File([Uint8Array.from(decodePrefabWad(checked.wad.base64))],checked.wad.filename,{type:'application/octet-stream'});
}
export async function decodePrefabTextures(prefab:StudioPrefab,existing:readonly TextureAsset[]=[]):Promise<{file:File;textures:TextureAsset[];prefab:BspObjectPrefab}>{
 const checked=validateBspObjectPrefab(prefab);
 const file=prefabWadFile(checked);
 const textures=await parseWad(file,{remember:false});
 const names=prefabMaterialNames(checked);
 const missing=names.filter(name=>!textures.some(tex=>tex.name.toLowerCase()===name.toLowerCase()));
 if(missing.length)throw Error(`Embedded WAD is missing materials: ${missing.join(', ')}`);
 // GoldSrc resolves textures by 16-byte name, regardless of which WAD a face came from.
 // Never silently override an existing texture used in this MAP, even if its dimensions match.
 const collision=existing.flatMap(old=>textures.filter(tex=>old.name.toLowerCase()===tex.name.toLowerCase()&&
   (old.width!==tex.width||old.height!==tex.height||old.dataUrl!==tex.dataUrl)).map(tex=>`${tex.name} (${old.wad} / ${file.name})`));
 if(collision.length)throw Error(`Texture-name conflict: ${[...new Set(collision)].slice(0,8).join(', ')}. Import into a new MAP or resolve the existing material first.`);
 // A WAD with the same filename but different contents must not silently replace other previews.
 const prior=existing.filter(tex=>wadBase(tex.wad)===wadBase(file.name));
 const missingPrior=prior.filter(tex=>!textures.some(next=>next.name.toLowerCase()===tex.name.toLowerCase()));
 if(missingPrior.length)throw Error(`A different WAD named ${file.name} is already loaded (${missingPrior.slice(0,5).map(t=>t.name).join(', ')}). Rename/isolate the WAD before placing.`);
 return {file,textures,prefab:checked};
}
export function appendConfiguredWadPath(current:string,path:string):string{
 const entries=current.split(/[\r\n]+/).map(p=>p.trim()).filter(Boolean);
 const name=wadBase(path);
 if(entries.some(p=>wadBase(p)===name))return current;
 return [...entries,path].join('\n');
}
export function downloadPrefabWad(prefab:StudioPrefab):void{
 const file=prefabWadFile(prefab);
 const url=URL.createObjectURL(file);
 const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
/** Explicit user-initiated install; API will never replace an existing different file. */
export async function installPrefabWadForBuild(prefab:StudioPrefab,gameDir:string):Promise<string>{
 if(!gameDir.trim())throw Error('Configure the Sven Co-op game directory in Build Configuration first.');
 const file=prefabWadFile(prefab);
 const response=await fetch('/api/prefab-wad/install',{method:'POST',headers:{'Content-Type':'application/octet-stream','x-sven-game-dir':encodeURIComponent(gameDir.trim()),'x-sven-wad-name':file.name},body:file});
 const result=await response.json().catch(()=>({error:`HTTP ${response.status}`}));
 if(!response.ok||typeof result.path!=='string')throw Error(result.error??'Could not install prefab WAD.');
 return result.path;
}
