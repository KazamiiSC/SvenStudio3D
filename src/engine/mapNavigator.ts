import type {MapObject} from './types';

/** Read-only index for the MAP explorer. Rebuild only when project.objects changes. */
export type NavigatorKind='all'|'brush'|'entity';
export type NavigatorEntry={
 id:string;kind:'brush'|'entity';name:string;subtitle:string;hidden:boolean;locked:boolean;
 searchable:string;classname:string;textureText:string;layer:string;group:string;targetname:string;
};
export type NavigatorSearch={items:NavigatorEntry[];count:number};
export const MAX_NAVIGATOR_RESULTS=80;
const lower=(text:string|undefined)=>String(text||'').trim().toLocaleLowerCase();
export function buildNavigatorIndex(objects:readonly MapObject[]):NavigatorEntry[]{
 return objects.map(o=>{
  const classname=o.kind==='entity'?o.classname:'';
  const targetname=o.kind==='entity'?o.props.targetname||'':'';
  const textureText=o.kind==='brush'?[...new Set(o.faces.map(f=>f.texture))].join(' '):'';
  const props=o.kind==='entity'?Object.values(o.props).join(' '):'';
  const name=o.editorAlias||o.name;
  const subtitle=o.kind==='entity'?`${o.classname}${targetname?` · ${targetname}`:''}`:`${o.faces.length} faces${textureText?` · ${textureText.slice(0,54)}`:''}`;
  return {id:o.id,kind:o.kind,name,subtitle,hidden:!!o.hidden,locked:!!o.locked,
   classname:lower(classname),textureText:lower(textureText),layer:lower(o.layer),group:lower(o.group),targetname:lower(targetname),
   searchable:lower([o.id,o.name,o.editorAlias,classname,targetname,textureText,o.layer,o.group,props].filter(Boolean).join(' '))};
 });
}
/** Terms combine with AND. Optional `class:`, `texture:`, `layer:` and `target:` constrain one field. */
export function findNavigatorEntries(index:readonly NavigatorEntry[],query:string,kind:NavigatorKind='all',limit=MAX_NAVIGATOR_RESULTS):NavigatorSearch{
 const terms=lower(query).split(/\s+/).filter(Boolean).slice(0,12);
 const found:NavigatorEntry[]=[];let count=0;
 for(const entry of index){
  if(kind!=='all'&&entry.kind!==kind)continue;
  if(!terms.every(term=>{
   const colon=term.indexOf(':');
   if(colon>0){const key=term.slice(0,colon),value=term.slice(colon+1);
    if(key==='class'||key==='classname')return entry.classname.includes(value);
    if(key==='texture'||key==='tex')return entry.textureText.includes(value);
    if(key==='layer')return entry.layer.includes(value);
    if(key==='group')return entry.group.includes(value);
    if(key==='target')return entry.targetname.includes(value);
   }
   return entry.searchable.includes(term);
  }))continue;
  count++;
  if(found.length<Math.max(0,Math.floor(limit)))found.push(entry);
 }
 return {items:found,count};
}
