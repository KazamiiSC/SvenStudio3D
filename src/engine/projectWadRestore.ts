/** v2.4: when a project is opened, bring back the textures it uses.
 * The saved project lists its WADs (project.wadNames); the WAD files themselves live in the game folder.
 * Every face texture that is not loaded yet is looked up in the configured game directory (same
 * bounded server search the BSP Viewer uses), giving priority to the project's own WADs. Nothing is
 * written to the map or to the game files. */
import {useEditor} from '../store';
import {fetchBspAutoWads,autoWadTexturesToAssets} from './bspAutoWad';

let running:AbortController|null=null;
export function missingProjectTextures():string[]{
  const s=useEditor.getState();
  const loaded=new Set(s.textureAssets.map(a=>a.name.toLowerCase()));
  const names=new Set<string>();
  for(const o of s.project.objects)if(o.kind==='brush')for(const f of o.faces){const n=f.texture.trim();if(n&&!loaded.has(n.toLowerCase()))names.add(n);}
  return [...names];
}
export async function restoreProjectTextures():Promise<{loaded:number;missing:number}|null>{
  const s=useEditor.getState();
  const gameDir=s.settings.gameDir?.trim();
  if(!gameDir)return null;
  const needed=missingProjectTextures();
  if(!needed.length)return {loaded:0,missing:0};
  running?.abort();const controller=new AbortController();running=controller;
  try{
    const result=await fetchBspAutoWads(gameDir,s.project.wadNames,needed,controller.signal);
    if(controller.signal.aborted)return null;
    const assets=autoWadTexturesToAssets(result.textures);
    useEditor.getState().addTextureAssets(assets);
    const missing=missingProjectTextures().length;
    useEditor.getState().appendLogs([`Project textures: ${assets.length} restored from the game WADs${missing?`, ${missing} still missing (import their WAD)`:''}.`]);
    return {loaded:assets.length,missing};
  }catch(error){
    if((error as Error)?.name!=='AbortError')useEditor.getState().appendLogs([`Project textures: automatic WAD restore unavailable (${String(error)}).`]);
    return null;
  }finally{if(running===controller)running=null;}
}
