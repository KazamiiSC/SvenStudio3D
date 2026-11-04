import type { Project } from './types';
export function downloadText(content:string,fileName:string,type='text/plain'){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function saveProject(project:Project){downloadText(JSON.stringify(project,null,2),`${project.name.replace(/[^a-z0-9_-]/gi,'_')||'untitled'}.svenstudio.json`,'application/json')}
export async function readProject(file:File):Promise<Project>{
  const p=JSON.parse(await file.text());
  if(p.version!==1||!Array.isArray(p.objects)||!p.world)throw new Error('Unsupported or invalid Sven Studio project file.');
  if(p.target && p.target!=='svengine')throw new Error('Sven Studio supports Svengine projects only.');
  if(p.objects.length>100000)throw new Error('Project too large.');
  return {...p,target:'svengine'} as Project;
}
