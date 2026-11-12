/** MAP editor WAD-library management. A WAD may only be forgotten when it is
 * not the active preview source of a texture used by the current project or
 * any undo/redo project. Do not touch the game installation or build paths. */
import type {Project,TextureAsset} from './types.ts';
import {preferredTextureAssets,wadBasename} from './textureWadSelection.ts';

const sameWad=(a:string,b:string)=>wadBasename(a)===wadBasename(b);
const faceNames=(project:Project)=>new Set(project.objects.filter(o=>o.kind==='brush').flatMap(b=>b.faces.map(f=>f.texture.toLowerCase())));
/** Compute usage once for the WAD manager instead of rerunning a large map's
 * 70+ undo snapshots for every listed file. */
export function mapWadUsage(assets:readonly TextureAsset[],projects:readonly Project[],wadPaths:string[]=[]):Map<string,Set<string>>{
  const used=new Map<string,Set<string>>();
  for(const project of projects){
    const chosen=preferredTextureAssets([...assets],wadPaths,project.wadNames);
    for(const name of faceNames(project)){
      const source=chosen.get(name);if(!source)continue;
      const key=wadBasename(source.wad);
      const names=used.get(key)||new Set<string>();names.add(name);used.set(key,names);
    }
  }
  return used;
}
export interface MapWadRemovalPlan {ok:boolean;reason:'built-in'|'reserved'|'missing'|'used'|'available';usedTextures:string[];textureCount:number;activeProjectRefs:number}
export function planMapWadRemoval(
  wad:string,assets:readonly TextureAsset[],project:Project,history:readonly Project[]=[],future:readonly Project[]=[],wadPaths:string[]=[],usage?:Map<string,Set<string>>
):MapWadRemovalPlan{
  const textures=assets.filter(asset=>sameWad(asset.wad,wad));
  const activeProjectRefs=project.wadNames.filter(name=>sameWad(name,wad)).length;
  if(sameWad(wad,'svstudio.wad'))return {ok:false,reason:'built-in',usedTextures:[],textureCount:textures.length,activeProjectRefs};
  // decals.wad is shared with Decal Studio's separately cached assets.
  if(sameWad(wad,'decals.wad'))return {ok:false,reason:'reserved',usedTextures:[],textureCount:textures.length,activeProjectRefs};
  if(!wadBasename(wad)||!textures.length)return {ok:false,reason:'missing',usedTextures:[],textureCount:0,activeProjectRefs};
  const used=(usage??mapWadUsage(assets,[project,...history,...future],wadPaths)).get(wadBasename(wad))??new Set<string>();
  return {ok:used.size===0,reason:used.size?'used':'available',usedTextures:[...used].sort(),textureCount:textures.length,activeProjectRefs};
}
/** Remove a no-longer-used WAD from project-specific references; don't change
 * global Build Settings paths that the user configured manually. */
export function pruneMapWadReferences(project:Project,wad:string):Project{
  const names=project.wadNames.filter(name=>!sameWad(name,wad));
  const existing=project.world.wad;
  let world=project.world;
  if(existing&&existing.split(';').some(part=>part.trim()&&sameWad(part,wad))){
    const retained=existing.split(';').map(part=>part.trim()).filter(part=>part&&!sameWad(part,wad));
    const result=retained.length?retained.join(';')+';':'';
    if(result!==existing)world={...world,wad:result};
  }
  return names.length===project.wadNames.length&&world===project.world?project:{...project,wadNames:names,world};
}
