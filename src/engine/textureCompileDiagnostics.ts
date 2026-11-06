import type {Project,TextureAsset} from './types';
/** WAD content is name-addressed in GoldSrc; same-named textures in different
 * archives may render differently in the editor vs the compiled BSP. */
export function textureCompileWarnings(project:Project,assets:TextureAsset[],wadPaths:string[]):string[]{
  const used=new Set(project.objects.filter(o=>o.kind==='brush').flatMap(b=>b.faces.map(f=>f.texture.toLowerCase())));
  const variants=new Map<string,Map<string,string>>();
  for(const asset of assets){
    const name=asset.name.toLowerCase();if(!used.has(name))continue;
    const wads=variants.get(name)||new Map<string,string>();
    wads.set(asset.wad.toLowerCase(),`${asset.width}×${asset.height}`);variants.set(name,wads);
  }
  const warnings:string[]=[];
  for(const [name,wads] of variants)if(wads.size>1){
    warnings.push(`TEXTURE WAD COLLISION: ${name} appears in ${[...wads].map(([wad,size])=>`${wad} (${size})`).join(', ')}. Verify compiler WAD order.`);
  }
  const availableWads=new Set(wadPaths.map(path=>path.trim().replaceAll('\\','/').split('/').pop()?.toLowerCase()).filter(Boolean));
  if(availableWads.size){
    for(const [name,wads] of variants)if(![...wads.keys()].some(wad=>availableWads.has(wad))){
      warnings.push(`TEXTURE SOURCE: ${name} is previewed from ${[...wads.keys()].join(', ')}, but that WAD is not listed in Build Settings.`);
      if(warnings.length>=30)break;
    }
  }
  return warnings;
}
