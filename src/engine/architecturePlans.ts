/** Smart Architecture 2.0 — editable project metadata, never MAP keyvalues. */
import {createArchitecture,createMultipleWallOpenings,architecturePartSignature} from './architecture';
import {uid} from './types';
import type {ArchitectureKind,ArchitectureOptions} from './architecture';
import type {ArchitectureAssemblyRecord,Brush,OpeningRecord,Project,Vec3} from './types';

const copy=<T>(value:T):T=>structuredClone(value);

/** All openings on a wall are rebuilt together from the *original* wall.
 * This avoids cumulative CSG slivers and makes deletion truly reversible. */
export function rebuildWallOpeningPlan(project:Project,wallId:string,desired:OpeningRecord[],fallbackTexture:string):{
  project:Project;members:string[][]
}{
  if(desired.length>24)throw Error('A wall supports at most 24 editable openings. Divide long walls into sections for better compilation.');
  const originals=project.architectureOpenings||[];
  const current=originals.filter(r=>r.wall.id===wallId);
  if(!current.length)throw Error('No parametric wall found for this operation.');
  const wall=copy(current[0].wall);
  const obsolete=new Set(current.flatMap(r=>r.memberIds));
  const byId=new Map(project.objects.map(o=>[o.id,o]));
  for(const id of obsolete){
    if(!byId.has(id))throw Error('A wall section was removed manually. Undo that change before editing this opening.');
  }
  // v1.5.15+ saves a signature for each generated member. Old saved v1.5.14
  // openings remain editable, but their unavailable historical signatures
  // cannot be verified retroactively.
  for(const record of current){
    if(!record.memberSignatures)continue;
    if(record.memberSignatures.length!==record.memberIds.length)
      throw Error('Opening provenance is incomplete. Convert the wall to brushes before further edits.');
    for(const [index,id] of record.memberIds.entries()){
      const brush=byId.get(id);
      if(brush?.kind!=='brush'||architecturePartSignature(brush)!==record.memberSignatures[index])
        throw Error('This wall or frame has manual changes. Convert the wall to ordinary brushes before rebuilding openings.');
    }
  }
  const retained=project.objects.filter(o=>!obsolete.has(o.id));
  // Existing openings are allowed to be deleted or reordered but not pointed
  // to another wall or corrupted into duplicate records.
  if(desired.some(r=>r.wall.id!==wallId)||new Set(desired.map(r=>r.id)).size!==desired.length)
    throw Error('Inconsistent wall opening metadata.');
  if(!desired.length){
    const restored={...wall};
    return {project:{...project,objects:[...retained,restored],
      architectureOpenings:originals.filter(r=>r.wall.id!==wallId)},members:[[restored.id]]};
  }
  const texture=desired[0].texture||fallbackTexture;
  const built=createMultipleWallOpenings(wall,desired.map(r=>({kind:r.kind,center:r.center,options:r.options,texture:r.texture||texture})),texture);
  const signatures=new Map(built.objects.map(b=>[b.id,architecturePartSignature(b)]));
  const records=desired.map((r,index)=>({...r,wall:copy(wall),memberIds:built.memberIds[index],
    memberSignatures:built.memberIds[index].map(id=>signatures.get(id)!),texture:r.texture||texture}));
  return {project:{...project,objects:[...retained,...built.objects],
    architectureOpenings:[...originals.filter(r=>r.wall.id!==wallId),...records]},members:built.memberIds};
}

/** A complete freestanding assembly is versioned with signatures so changing
 * any of its generated brushes manually never gets silently overwritten. */
export function assertArchitectureAssemblyUnmodified(project:Project,assembly:ArchitectureAssemblyRecord):void{
  if(assembly.memberIds.length!==assembly.signatures.length||!assembly.memberIds.length)
    throw Error('Architecture assembly metadata is incomplete.');
  for(const [index,id] of assembly.memberIds.entries()){
    const part=project.objects.find(o=>o.id===id);
    if(!part||part.kind!=='brush'||architecturePartSignature(part)!==assembly.signatures[index])
      throw Error('This structure has manual changes. Undo them or convert the structure to ordinary brushes before rebuilding.');
  }
}
export function buildArchitectureAssembly(kind:ArchitectureKind,options:ArchitectureOptions,origin:Vec3,texture:string):{
  record:ArchitectureAssemblyRecord;objects:Brush[]
}{
  if(kind==='door'||kind==='window')throw Error('Use the interactive wall opening tool for doors and windows.');
  if(origin.some(v=>!Number.isFinite(v)))throw Error('Invalid structure position.');
  const built=createArchitecture(kind,options,null,texture,undefined,origin);
  const objects=built.objects.filter((o):o is Brush=>o.kind==='brush');
  if(!objects.length)throw Error('The structure generator returned no brushes.');
  return {objects,record:{id:uid(),kind,origin:copy(origin),options:copy(options),texture,
    memberIds:objects.map(o=>o.id),signatures:objects.map(architecturePartSignature)}};
}
export function replaceArchitectureAssembly(project:Project,id:string,options:ArchitectureOptions,origin:Vec3):{
  project:Project;memberIds:string[]
}{
  const assemblies=project.architectureAssemblies||[];
  const record=assemblies.find(a=>a.id===id);
  if(!record)throw Error('Structure no longer exists.');
  assertArchitectureAssemblyUnmodified(project,record);
  const replacement=buildArchitectureAssembly(record.kind,options,origin,record.texture);
  const obsolete=new Set(record.memberIds);
  return {project:{...project,objects:[...project.objects.filter(o=>!obsolete.has(o.id)),...replacement.objects],
    architectureAssemblies:assemblies.map(a=>a.id===id?{...replacement.record,id}:a)},
    memberIds:replacement.record.memberIds};
}
export function removeArchitectureAssembly(project:Project,id:string):Project{
  const records=project.architectureAssemblies||[];
  const record=records.find(a=>a.id===id);
  if(!record)throw Error('Structure no longer exists.');
  assertArchitectureAssemblyUnmodified(project,record);
  const obsolete=new Set(record.memberIds);
  return {...project,objects:project.objects.filter(o=>!obsolete.has(o.id)),
    architectureAssemblies:records.filter(a=>a.id!==id)};
}
/** Stop automatic tracking while retaining the real, user-edited convex brushes. */
export function detachArchitectureAssembly(project:Project,id:string):Project{
  return {...project,architectureAssemblies:(project.architectureAssemblies||[]).filter(a=>a.id!==id)};
}
