import {saveStudioText} from './studioFiles';
import type { Project } from './types';
import {validateProjectFile} from './projectValidation';
export function downloadText(content:string,fileName:string,_type='text/plain'){
  const category=fileName.toLowerCase().endsWith('.svprefab')?'prefabs':fileName.toLowerCase().endsWith('.map')?'maps':fileName.toLowerCase().endsWith('.svenstudio.json')?'projects':'exports';
  return saveStudioText(content,fileName,category);
}
export function saveProject(project:Project){return downloadText(JSON.stringify(project,null,2),`${project.name.replace(/[^a-z0-9_-]/gi,'_')||'untitled'}.svenstudio.json`,'application/json')}
export async function readProject(file:File):Promise<Project>{
  if(file.size>64*1024*1024)throw new Error('Project exceeds the 64 MB safety limit.');
  let input:unknown;
  try{input=JSON.parse(await file.text())}catch{throw new Error('Project JSON is not valid. The current map was not changed.')}
  return validateProjectFile(input);
}
