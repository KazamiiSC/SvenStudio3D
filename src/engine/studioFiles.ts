/** File output to the Windows user Documents/SvenStudio3D folders via local Node.
 * Explicit saves never fall back to the browser Downloads folder silently.
 */
export type StudioFileCategory='projects'|'prefabs'|'maps'|'exports';
export type SavedStudioFile={path:string;filename:string;category:StudioFileCategory;bytes:number};
export async function saveStudioBlob(blob:Blob,filename:string,category:StudioFileCategory):Promise<SavedStudioFile>{
 const response=await fetch('/api/studio-files/save',{method:'POST',headers:{'Content-Type':'application/octet-stream','x-sven-category':category,'x-sven-filename':encodeURIComponent(filename)},body:blob});
 const data=await response.json().catch(()=>({error:`HTTP ${response.status}`}));
 if(!response.ok)throw new Error(data.error||`Could not save ${filename}`);
 return data as SavedStudioFile;
}
export async function saveStudioText(content:string,filename:string,category:StudioFileCategory):Promise<SavedStudioFile>{
 return saveStudioBlob(new Blob([content],{type:'text/plain;charset=utf-8'}),filename,category);
}
export async function studioFiles(category:StudioFileCategory):Promise<{files:{name:string;bytes:number;modified:number}[]}>{
 const response=await fetch(`/api/studio-files/list?category=${encodeURIComponent(category)}`);
 if(!response.ok)throw Error(`Cannot list ${category}`);
 return response.json();
}
export async function readStudioText(category:StudioFileCategory,name:string):Promise<string>{
 const response=await fetch(`/api/studio-files/read?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}`);
 if(!response.ok)throw Error(`Cannot read ${name}`);
 return response.text();
}
