import type { Project } from './types';
import {validateProjectFile} from './projectValidation';
export function downloadText(content:string,fileName:string,type='text/plain'){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function saveProject(project:Project){downloadText(JSON.stringify(project,null,2),`${project.name.replace(/[^a-z0-9_-]/gi,'_')||'untitled'}.svenstudio.json`,'application/json')}
export async function readProject(file:File):Promise<Project>{
  if(file.size>64*1024*1024)throw new Error('Project exceeds the 64 MB safety limit.');
  let input:unknown;
  try{input=JSON.parse(await file.text())}catch{throw new Error('Project JSON is not valid. The current map was not changed.')}
  return validateProjectFile(input);
}
