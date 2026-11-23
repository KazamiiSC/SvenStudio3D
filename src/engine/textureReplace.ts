/** Find and replace brush-face textures across the map or a selection.
 * GoldSrc texture names are case-insensitive. Only the texture name changes:
 * shift, scale, rotation and Valve 220 axes stay as they were, so alignment is kept.
 * Hidden and locked brushes are never touched, like every other texture tool.
 */
import type {Brush,MapObject} from './types';

export type TextureMatchMode='exact'|'contains';
export type TextureReplaceScope='map'|'selection';
export type TextureUsage={texture:string;faces:number;brushes:number};
export type TextureReplaceOptions={find:string;replace:string;match?:TextureMatchMode;scope?:TextureReplaceScope;selectedIds?:readonly string[]};
export type TextureReplacePlan={objects:MapObject[];faces:number;brushes:number;skippedLocked:number;textures:string[]};

const key=(name:string)=>name.trim().toLowerCase();
const editable=(o:MapObject):o is Brush=>o.kind==='brush'&&!o.hidden&&!o.locked;

/** Every texture used by brush faces, most used first. */
export function textureUsage(objects:readonly MapObject[]):TextureUsage[]{
  const usage=new Map<string,{texture:string;faces:number;brushes:Set<string>}>();
  for(const o of objects){
    if(o.kind!=='brush')continue;
    for(const f of o.faces){
      if(!f.texture)continue;
      const k=key(f.texture);
      const entry=usage.get(k)??{texture:f.texture,faces:0,brushes:new Set<string>()};
      entry.faces++;entry.brushes.add(o.id);usage.set(k,entry);
    }
  }
  return [...usage.values()].map(u=>({texture:u.texture,faces:u.faces,brushes:u.brushes.size}))
    .sort((a,b)=>b.faces-a.faces||a.texture.localeCompare(b.texture));
}

export function textureMatches(texture:string,find:string,match:TextureMatchMode='exact'):boolean{
  const t=key(texture),f=key(find);
  if(!f)return false;
  return match==='contains'?t.includes(f):t===f;
}

/** GoldSrc WAD names are at most 15 characters, printable, without spaces. */
export function validTextureName(name:string):boolean{
  return /^[!-~]{1,15}$/.test(name.trim());
}

/** Pure planner: returns the new object list and counts; nothing changes when faces===0. */
export function planTextureReplace(objects:readonly MapObject[],options:TextureReplaceOptions):TextureReplacePlan{
  const {find,replace,match='exact',scope='map'}=options;
  const target=replace.trim();
  if(!key(find))throw Error('Enter the texture to find.');
  if(!validTextureName(target))throw Error('The new texture name must have 1–15 characters and no spaces.');
  const inScope=scope==='selection'?new Set(options.selectedIds??[]):null;
  let faces=0,brushes=0,skippedLocked=0;const replaced=new Set<string>();
  const next=objects.map(o=>{
    if(o.kind!=='brush')return o;
    if(inScope&&!inScope.has(o.id)&&!(o.entityId&&inScope.has(o.entityId)))return o;
    const hits=o.faces.some(f=>textureMatches(f.texture,find,match)&&key(f.texture)!==key(target));
    if(!hits)return o;
    if(!editable(o)){skippedLocked++;return o;}
    let count=0;
    const updated=o.faces.map(f=>{
      if(!textureMatches(f.texture,find,match)||key(f.texture)===key(target))return f;
      count++;replaced.add(f.texture);
      return {...f,texture:target};
    });
    faces+=count;brushes++;
    return {...o,faces:updated};
  });
  return {objects:next,faces,brushes,skippedLocked,textures:[...replaced].sort()};
}

/** Ids of editable brushes that use the texture (for "select brushes with this texture"). */
export function brushesUsingTexture(objects:readonly MapObject[],texture:string,match:TextureMatchMode='exact'):string[]{
  return objects.filter(o=>editable(o)&&o.faces.some(f=>textureMatches(f.texture,texture,match))).map(o=>o.id);
}
