/** HF8: resolve only WADs that provide textures used on current brush faces.
 * Reuses the browser WAD cache and embedded prefab WADs; never reads arbitrary
 * files or adds unreferenced prefab textures to a compile request.
 */
import type {Project,TextureAsset} from './types';
import type {StudioPrefab} from './prefabStudioFolder';
import {loadSavedWadFiles} from './wadPersistence';

export type BrowserBuildWad={name:string;base64:string};
const base=(name:string)=>name.replaceAll('\\','/').split('/').pop()?.toLowerCase()||'';
const WAD_NAME=/^[a-z0-9_.+~()-]{1,100}\.wad$/i;
export function neededBuildWadNames(project:Pick<Project,'objects'>,assets:readonly TextureAsset[]):Set<string>{
  const used=new Set<string>();
  for(const item of project.objects)if(item.kind==='brush')for(const f of item.faces)used.add(f.texture.toLowerCase());
  return new Set(assets.filter(a=>used.has(a.name.toLowerCase())).map(a=>base(a.wad)).filter(n=>WAD_NAME.test(n)&&n!=='svstudio.wad'));
}
function encode(bytes:Uint8Array):string{
  let result='';const step=0x4000;
  for(let i=0;i<bytes.length;i+=step)result+=String.fromCharCode(...bytes.subarray(i,i+step));
  return btoa(result);
}
export async function browserWadsForSmartBuild(project:Project,assets:readonly TextureAsset[],prefabs:readonly StudioPrefab[]=[]):Promise<BrowserBuildWad[]>{
  const needed=neededBuildWadNames(project,assets),out:BrowserBuildWad[]=[];
  if(!needed.size)return out;
  let cached:File[]=[];
  try{cached=await loadSavedWadFiles();}catch{/* no IndexedDB permission: on-disk WAD fallback */}
  let sum=0;
  for(const filename of [...needed].sort()){
    const file=cached.find(f=>base(f.name)===filename);
    let bytes:Uint8Array|undefined;
    if(file)bytes=new Uint8Array(await file.arrayBuffer());
    else {
      const prefab=prefabs.find(p=>base(p.wad?.filename||'')===filename&&typeof p.wad?.base64==='string');
      if(prefab?.wad?.base64){
        // An embedded prefab may have been saved before the browser WAD cache.
        const binary=atob(prefab.wad.base64);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      }
    }
    if(!bytes)continue; // server may have it on disk
    sum+=bytes.length;
    if(bytes.length>14*1024*1024||sum>20*1024*1024||out.length>=20)throw Error('Smart WAD: demasiados WAD cargados en el navegador para esta compilación. Instalá los más grandes o reducí recursos.');
    if(bytes.length<12||String.fromCharCode(...bytes.subarray(0,4))!=='WAD3')throw Error(`No es WAD3: ${filename}`);
    out.push({name:filename,base64:encode(bytes)});
  }
  return out;
}
