/** Local-only factory reset for SvenStudio 3D. No operating-system, game or SDK writes. */
import {forgetSavedWadFiles} from './wadPersistence';
import {forgetPrefabFolder} from './prefabStudioFolder';
import {clearRecoveryForFactoryReset,cancelRecoveryReset} from './sessionRecovery';
const matchesStudioKey=(key:string)=>/^(?:svenstudio|sven-studio|svstudio|sven-bsp|sven:|svenstudio:|svenstudio-|svenstudio_)/i.test(key);
export function studioStorageKeys(storage:Pick<Storage,'length'|'key'>):string[]{
  const keys:string[]=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(key&&matchesStudioKey(key))keys.push(key);
  }
  return keys;
}
export async function resetStudioBrowserData():Promise<void>{
  // Clear recovery FIRST and suppress pending writes while the page reloads.
  try{
    await clearRecoveryForFactoryReset();
    await forgetSavedWadFiles();
    await forgetPrefabFolder();
    for(const key of studioStorageKeys(localStorage))localStorage.removeItem(key);
    for(const key of studioStorageKeys(sessionStorage))sessionStorage.removeItem(key);
  }catch(error){cancelRecoveryReset();throw error;}
}
