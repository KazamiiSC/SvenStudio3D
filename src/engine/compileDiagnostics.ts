import type {Vec3} from './types';
export type DoctorSeverity='error'|'warning'|'info';
export type BuildFinding={code:string;severity:DoctorSeverity;messageKey:string;params?:Record<string,string|number>;stage?:string};
export type CompileEvent={type:string;message:string;stage?:string;kind?:string;points?:unknown};
const maxBytes=1024*1024;
const numeric='[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
const pointPattern=new RegExp(`^\\s*\\(?\\s*(${numeric})\\s+(${numeric})\\s+(${numeric})\\s*\\)?\\s*$`);
/** Parse user-imported GoldSrc .pts/.lin locally; no upload to the compiler API. */
export function parsePointfile(text:string):Vec3[]{
 if(typeof text!=='string'||text.length>maxBytes)return [];
 const result:Vec3[]=[];
 for(const line of text.split(/\r?\n/)){
  const match=pointPattern.exec(line);if(!match)continue;
  const point=match.slice(1).map(Number) as Vec3;
  if(point.some(n=>!Number.isFinite(n)||Math.abs(n)>1e7))continue;
  if(result.length&&result[result.length-1].every((n,i)=>n===point[i]))continue;
  result.push(point);if(result.length>20000)break;
 }
 if(result.length<2)return [];
 if(result.length<=4096)return result;
 return Array.from({length:4096},(_,i)=>result[Math.floor(i*(result.length-1)/4095)]);
}
/** A compiler-provided trace is accepted only as a bounded array of finite vec3s. */
export function validateTrace(points:unknown):Vec3[]{
 if(!Array.isArray(points)||points.length>4096||points.length<2)return [];
 const valid:Vec3[]=[];
 for(const p of points){
  if(!Array.isArray(p)||p.length!==3||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e7))return [];
  valid.push([p[0],p[1],p[2]]);
 }
 return valid;
}
/** Compile findings are based on actual compiler output, not speculative checks. */
export function analyzeBuildLog(lines:readonly string[]):BuildFinding[]{
 const text=lines.join('\n'),findings:BuildFinding[]=[];
 const add=(code:string,severity:DoctorSeverity,messageKey:string,stage?:string,params?:Record<string,string|number>)=>findings.push({code,severity,messageKey,stage,params});
 const hulls=[...new Set([...text.matchAll(/LEAK\s+in\s+hull\s+(\d+)/gi)].map(m=>m[1]))];
 if(hulls.length)add('BSP_LEAK','error','Compiler detected a leak in hulls {hulls}. Follow the pointfile route to find the opening.','BSP',{hulls:hulls.join(', ')});
 if(/(?:illegal brush|plane with no normal|coplanar plane|non.planar brush|brush with no volume)/i.test(text))add('INVALID_BRUSH','error','The compiler reported invalid brush geometry. Inspect the affected brushes in Map Doctor and the original compiler log.','CSG');
 if(/(?:texture not found|could not find texture|missing texture|wad file not found|couldn.t open wad)/i.test(text))add('MISSING_TEXTURE','warning','The compiler could not find a texture or WAD. Review the configured WAD paths.','CSG');
 if(/(?:0 base patches|0 patches created|Create Patches\s*:\s*0 base patches)/i.test(text))add('RAD_NO_PATCHES','warning','RAD found no lighting patches. Verify that the playable space is not filled by a solid SKY brush.','RAD');
 if(/(?:RAD exited with code (?:3221225477|-1073741819)|access violation.*(?:RAD|hlrad))/i.test(text))add('RAD_CRASH','error','SC-RAD crashed while calculating lighting. Review the RAD log and brush geometry; the exact cause is not proven.','RAD');
 if(/VIS exited with code [1-9]\d*/i.test(text)&&!hulls.length)add('VIS_FAILED','error','SC-VIS failed. Review the full compiler log for leaks or invalid portal geometry.','VIS');
 if(/(?:maximum.*(?:planes|clipnodes|marksurfaces)|too many (?:planes|clipnodes|brushes|faces))/i.test(text))add('ENGINE_LIMIT','error','A GoldSrc engine or compiler limit was reported. Check the exact limit in the compiler log.');
 return findings;
}
export function renderDoctorMessage(template:string,params:Record<string,string|number>={}){
 return Object.entries(params).reduce((text,[key,value])=>text.replaceAll(`{${key}}`,String(value)),template);
}
