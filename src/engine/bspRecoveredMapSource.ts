/** Preserving-composition layer for recovered Valve 220 MAP source.
 * Keep SurfDecomp's original brush planes and texture mapping unchanged on
 * the primary map instead of exporting an approximated editor mesh again.
 * Secondary brush planes are translated without reconstructing their mesh.
 */
import type {MapImportResult,MapImportReport} from './importMap';
import type {Vec3} from './types';

interface RawMapEntity { properties:string[]; brushes:string[][]; }
const FLOAT='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?';
const POINT=new RegExp(`\\(\\s*(${FLOAT})\\s+(${FLOAT})\\s+(${FLOAT})\\s*\\)`,'g');
const AXIS=new RegExp(`\\[\\s*(${FLOAT})\\s+(${FLOAT})\\s+(${FLOAT})\\s+(${FLOAT})\\s*\\]`,'g');
const PROPERTY=/^(\s*)"([^"\r\n]+)"\s+"([^"\r\n]*)"\s*$/;
const LINK_KEYS=new Set(['target','killtarget','master','netname']);
const fmt=(n:number)=>String(Math.round(n*100000)/100000);

/** MAP braces are structural only when alone on a line. Textures can start with '{'. */
function parseSource(source:string):RawMapEntity[]{
  const entities:RawMapEntity[]=[];
  let depth=0,entity:RawMapEntity|null=null,brush:string[]|null=null;
  for(const line of source.split(/\r?\n/)){
    const tag=line.trim();
    if(tag==='{'){
      if(depth===0)entity={properties:[],brushes:[]};
      else if(depth===1)brush=[];
      else throw Error('Nested MAP brush blocks are not supported.');
      depth++;
      continue;
    }
    if(tag==='}'){
      if(depth===2&&entity&&brush){entity.brushes.push(brush);brush=null;}
      else if(depth===1&&entity){entities.push(entity);entity=null;}
      else throw Error('Unbalanced recovered MAP braces.');
      depth--;
      continue;
    }
    if(depth===1&&entity)entity.properties.push(line);
    else if(depth===2&&brush)brush.push(line);
  }
  if(depth!==0||!entities.length)throw Error('Recovered MAP contains incomplete entities or brushes.');
  if(propertyValue(entities[0].properties,'classname')!=='worldspawn')throw Error('Recovered MAP does not start with a worldspawn entity.');
  return entities;
}
function propertyValue(lines:string[],key:string):string|undefined{
  for(const line of lines){const m=PROPERTY.exec(line);if(m?.[2]===key)return m[3];}
}
function setProperty(lines:string[],key:string,value:string):string[]{
  let found=false;
  const out=lines.map(line=>{
    const m=PROPERTY.exec(line);
    if(!m||m[2]!==key)return line;
    found=true;return `${m[1]}"${key}" "${value.replace(/["\r\n]/g,' ')}"`;
  });
  if(!found)out.push(`"${key}" "${value.replace(/["\r\n]/g,' ')}"`);
  return out;
}
const formatEntity=(entity:RawMapEntity)=>['{',...entity.properties,...entity.brushes.flatMap(b=>['{',...b,'}']),'}'].join('\n');
const isZero=(offset:readonly number[])=>offset.every(x=>x===0);
function shiftOrigin(value:string,offset:readonly number[]):string{
  const parts=value.trim().split(/\s+/).map(Number);
  if(parts.length!==3||!parts.every(Number.isFinite))throw Error('A source entity has a nonnumeric origin and cannot be translated safely.');
  const next=parts.map((n,i)=>n+offset[i]);
  if(next.some(n=>Math.abs(n)>131072))throw Error('Translated entity origin exceeds the coordinate safety limit.');
  return next.map(fmt).join(' ');
}
function translateProperties(lines:string[],offset:readonly number[],names:Set<string>,prefix:string):string[]{
  return lines.map(line=>{
    const m=PROPERTY.exec(line);
    if(!m)return line;
    const [,indent,key,value]=m;
    let next=value;
    if(key==='origin'&&!isZero(offset))next=shiftOrigin(value,offset);
    else if((key==='targetname'||LINK_KEYS.has(key))&&names.has(value))next=prefix+value;
    return `${indent}"${key}" "${next}"`;
  });
}
function translateFace(line:string,offset:readonly number[]):string{
  if(isZero(offset)||!line.trim()||line.trim().startsWith('//'))return line;
  POINT.lastIndex=0;
  const matches=[...line.matchAll(POINT)];
  if(matches.length<3)throw Error('Source brush contains a face without three valid plane points.');
  let i=0;
  let moved=line.replace(POINT,(match,x,y,z)=>{
    if(i++>=3)return match;
    const next=[Number(x),Number(y),Number(z)].map((n,j)=>n+offset[j]);
    if(next.some(n=>!Number.isFinite(n)||Math.abs(n)>131072))throw Error('Translated brush plane exceeds the coordinate safety limit.');
    return `( ${next.map(fmt).join(' ')} )`;
  });
  // Valve 220 UV coordinates are world-space. Compensate shift when moving the
  // solid so visible textures remain at the same position on the brush.
  AXIS.lastIndex=0;
  const axes=[...moved.matchAll(AXIS)];
  if(axes.length>=2){
    const remainder=moved.slice((axes[1].index??0)+axes[1][0].length).trim().split(/\s+/);
    const scales=[Number(remainder[1]),Number(remainder[2])];
    for(let a=1;a>=0;a--){
      const axis=axes[a],scale=Number.isFinite(scales[a])&&scales[a]!==0?scales[a]:1;
      const delta=(Number(axis[1])*offset[0]+Number(axis[2])*offset[1]+Number(axis[3])*offset[2])/scale;
      const replacement=`[ ${axis[1]} ${axis[2]} ${axis[3]} ${fmt(Number(axis[4])-delta)} ]`;
      const start=axis.index??0;
      moved=moved.slice(0,start)+replacement+moved.slice(start+axis[0].length);
    }
  }
  return moved;
}
/** Reconstruct raw MAP blocks based on the previously verified source-index IDs. */
function retainValidBrushes(entities:RawMapEntity[],parsed:MapImportResult,allowPartial:boolean):RawMapEntity[]{
  const valid=new Set(parsed.importedBrushes.map(x=>x.sourceBrushIndex));
  let idx=0,seen=0;
  const result=entities.map(entity=>({...entity,properties:[...entity.properties],brushes:entity.brushes.filter(()=>{
    const keep=valid.has(idx++);if(!keep&&!allowPartial)throw Error('MAP contains unreconstructable geometry.');
    if(keep)seen++;return keep;
  })}));
  if(idx!==parsed.report.totalBrushes||seen!==parsed.report.importedBrushes)throw Error('Recovered MAP brush indices do not match the verification report.');
  return result;
}

export function composeRecoveredMapSource(primarySource:string,secondarySource:string,primary:MapImportResult,secondary:MapImportResult,offset:Vec3,prefix:string,allowPartial:boolean):string{
  const a=retainValidBrushes(parseSource(primarySource),primary,allowPartial);
  const b=retainValidBrushes(parseSource(secondarySource),secondary,allowPartial);
  const srcNames=new Set(secondary.project.objects.filter(x=>x.kind==='entity').map(x=>x.props.targetname).filter(Boolean));
  const destinationNames=new Set(primary.project.objects.filter(x=>x.kind==='entity').map(x=>x.props.targetname).filter(Boolean));
  if([...srcNames].some(name=>destinationNames.has(prefix+name)))throw Error('Target names conflict with the primary map. Choose a different target prefix.');
  const primaryWad=(propertyValue(a[0].properties,'wad')||'').split(';').filter(Boolean);
  const secondaryWad=(propertyValue(b[0].properties,'wad')||'').split(';').filter(Boolean);
  const paths=[...new Set([...primaryWad,...secondaryWad])];
  if(paths.length)a[0].properties=setProperty(a[0].properties,'wad',paths.join(';')+';');
  a[0].brushes.push(...b[0].brushes.map(lines=>lines.map(line=>translateFace(line,offset))));
  for(const entity of b.slice(1)){
    a.push({
      properties:translateProperties(entity.properties,offset,srcNames,prefix),
      brushes:entity.brushes.map(lines=>lines.map(line=>translateFace(line,offset))),
    });
  }
  return '// SvenStudio 3D - composed recovered MAP (requires full recompilation)\n'+a.map(formatEntity).join('\n')+'\n';
}

