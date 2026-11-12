/** Optional session-only MDL files from a user-selected local folder.
 * Never sends files to the server, never writes to disk or BSP itself. */
import {parseGoldSrcMdl,type StudioPreview} from '../engine/mdl';
import {bspLocalModelKey,bspLocalModelAliases} from '../engine/bspLocalModelPaths';
export async function loadLocalBspModels(files:FileList):Promise<{models:Map<string,StudioPreview>;errors:string[]}>{
  const errors:string[]=[],models=new Map<string,StudioPreview>();
  const entries=new Map<string,File>();
  for(const file of Array.from(files)){
    const key=bspLocalModelKey(file.webkitRelativePath||file.name);
    if(key&&file.size<=32*1024*1024)entries.set(key,file);
  }
  if(entries.size>450)throw Error('Folder contains too many MDL files (max 450). Choose a smaller model folder.');
  if([...entries.values()].reduce((sum,file)=>sum+file.size,0)>256*1024*1024)
    throw Error('Model folder is too large (max 256 MiB). Choose a smaller folder.');
  const isCompanion=(key:string)=>/t\.mdl$|\d\d\.mdl$/i.test(key)&&
    [...entries.keys()].some(main=>main!==key&&(key.replace(/t\.mdl$|\d\d\.mdl$/i,'.mdl')===main));
  const bases=[...entries.keys()].filter(key=>!isCompanion(key));
  if(bases.length>90)throw Error('Too many independent models (max 90). Choose a smaller folder.');
  for(const key of bases){
    try{
      const main=await entries.get(key)!.arrayBuffer();
      const companion=entries.get(key.replace(/\.mdl$/i,'t.mdl'));
      const groups:Record<number,ArrayBuffer>={};
      const view=new DataView(main),count=main.byteLength>=176?view.getInt32(172,true):0;
      for(let i=1;i<Math.min(16,Math.max(1,count));i++){
        const group=entries.get(key.replace(/\.mdl$/i,`${String(i).padStart(2,'0')}.mdl`));
        if(group)groups[i]=await group.arrayBuffer();
      }
      const parsed=parseGoldSrcMdl(main,companion?await companion.arrayBuffer():undefined,groups);
      for(const alias of bspLocalModelAliases(entries.get(key)!.webkitRelativePath||entries.get(key)!.name))models.set(alias,parsed);
    }catch(error){errors.push(`${key}: ${String(error instanceof Error?error.message:error)}`)}
  }
  return {models,errors};
}
