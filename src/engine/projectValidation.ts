/** Defensive validation for imported Sven Studio project JSON.
 * Validate before replacing the editing session: never repair or discard objects silently.
 * This is intentionally a structural check, not a CSG validity check. Users must still
 * be able to open an editable map with a brush that Map Doctor needs to repair.
 */
import type {Face,MapObject,Project,Vec3} from './types';
import {validateCustomNpc} from './customNpc';

type Obj=Record<string,unknown>;
const record=(v:unknown):v is Obj=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown,max=1024):v is string=>typeof v==='string'&&v.length<=max;
const vec3=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1_000_000);
const textMap=(v:unknown,maxEntries=8192):v is Record<string,string>=>record(v)&&Object.keys(v).length<=maxEntries&&Object.entries(v).every(([k,val])=>k.length<=512&&str(val,65536));
const optionalText=(v:unknown,max=1024)=>v===undefined||str(v,max);
const optionalBoolean=(v:unknown)=>v===undefined||typeof v==='boolean';
const optionalNumber=(v:unknown)=>v===undefined||(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1_000_000);
const primitives=new Set(['box','wedge','cylinder','cone','pyramid','icosphere','archSegment','poly']);
function bad(message:string):never{throw Error(`Invalid project: ${message}`)}

function checkFace(face:unknown,vertices:number,label:string):asserts face is Face{
  if(!record(face)||!Array.isArray(face.indices)||face.indices.length<3||face.indices.length>vertices||
     !face.indices.every(i=>Number.isInteger(i)&&i>=0&&i<vertices)||new Set(face.indices).size!==face.indices.length||
     !str(face.texture,256))bad(`${label} has invalid face indices or texture.`);
  for(const key of ['uShift','vShift','uScale','vScale','rotation'])if(!optionalNumber(face[key]))bad(`${label} has invalid ${key}.`);
  for(const key of ['uAxis','vAxis'])if(face[key]!==undefined&&!vec3(face[key]))bad(`${label} has invalid ${key}.`);
}
function checkBrush(brush:Obj,label:string){
  if(!primitives.has(String(brush.primitive))||!vec3(brush.rotation)||!vec3(brush.scale)||
     brush.scale.some(x=>Math.abs(x)<1e-8)||!Array.isArray(brush.vertices)||!Array.isArray(brush.faces)||
     brush.vertices.length<4||brush.vertices.length>1024||brush.faces.length<4||brush.faces.length>1024||
     !brush.vertices.every(vec3))bad(`${label} has invalid brush geometry.`);
  for(const [fi,face] of brush.faces.entries())checkFace(face,brush.vertices.length,`${label}, face ${fi+1}`);
  if(!optionalText(brush.entityId,256))bad(`${label} has invalid entityId.`);
}
function checkObject(value:unknown,index:number):asserts value is MapObject{
  const label=`object ${index+1}`;
  if(!record(value)||!str(value.id,256)||!value.id||!str(value.name,1024)||!vec3(value.position)||
     !optionalText(value.layer,256)||!optionalText(value.group,256)||
     !optionalBoolean(value.hidden)||!optionalBoolean(value.locked))bad(`${label} is malformed.`);
  if(value.kind==='brush')checkBrush(value,label);
  else if(value.kind==='entity'){
    if(!str(value.classname,256)||!value.classname||!textMap(value.props))bad(`${label} has invalid entity properties.`);
  }else bad(`${label} has unknown kind.`);
}
function checkOpening(value:unknown,index:number){
  if(!record(value)||!str(value.id,256)||(value.kind!=='door'&&value.kind!=='window')||
     !record(value.wall)||!Array.isArray(value.memberIds)||value.memberIds.length>2048||
     !value.memberIds.every(v=>str(v,256))||!vec3(value.center)||!record(value.options))
    bad(`architecture opening ${index+1} is malformed.`);
  const wall={...value.wall,kind:'brush'};checkObject(wall,index);
  for(const key of ['width','height','depth','frame','steps'])if(!optionalNumber(value.options[key]))bad(`architecture opening ${index+1} has invalid ${key}.`);
  for(const key of ['cutOnly','doorLeaf','openTop'])if(!optionalBoolean(value.options[key]))bad(`architecture opening ${index+1} has invalid ${key}.`);
  if(!optionalText(value.texture,32))bad(`architecture opening ${index+1} has invalid texture.`);
  if(value.memberSignatures!==undefined&&(!Array.isArray(value.memberSignatures)||
     value.memberSignatures.length!==value.memberIds.length||!value.memberSignatures.every(v=>str(v,64))))
    bad(`architecture opening ${index+1} has invalid provenance.`);
}
/** Throws on corrupt input, preserving the existing editor state. Never mutates input. */
export function validateProjectFile(input:unknown):Project{
  if(!record(input)||input.version!==1||!str(input.name,512)||!textMap(input.world)||
     !Array.isArray(input.objects)||input.objects.length>100000||
     !Array.isArray(input.wadNames)||input.wadNames.length>4096||!input.wadNames.every(v=>str(v,1024)))
    bad('unsupported version or missing project fields.');
  if(input.target!==undefined&&input.target!=='svengine')bad('only Sven Co-op / Svengine projects are supported.');
  const ids=new Set<string>();
  for(const [i,obj] of input.objects.entries()){
    checkObject(obj,i);
    if(ids.has(obj.id))bad(`duplicate object ID at ${i+1}.`);
    ids.add(obj.id);
  }
  if(input.customNpcs!==undefined){
    if(!Array.isArray(input.customNpcs)||input.customNpcs.length>80)bad('custom NPC definitions are malformed.');
    const seen=new Set<string>();
    for(const [i,d] of input.customNpcs.entries()){
      if(!record(d)||!str(d.classname,96)||!d.classname||!str(d.description,256)||!str(d.modelPath,256)||
         !str(d.entryScript,240)||!str(d.registerFunction,128)||!Array.isArray(d.scripts)||d.scripts.length>40||
         !d.scripts.every((s:unknown)=>record(s)&&str(s.path,240)&&str(s.source,2_000_000)))
         bad(`custom NPC ${i+1} has invalid metadata.`);
      if(validateCustomNpc(d as unknown as import('./customNpc').CustomNpcDefinition).length)bad(`custom NPC ${i+1} has invalid source or paths.`);
      if(seen.has(d.classname))bad(`duplicate custom NPC classname: ${d.classname}`);
      seen.add(d.classname);
      if(d.fgd!==undefined&&(!record(d.fgd)||d.fgd.type!=='point'||d.fgd.name!==d.classname||!record(d.fgd.props)||
        Object.keys(d.fgd.props).length>256||!Object.values(d.fgd.props).every(p=>record(p)&&str(p.label,256)&&str(p.type,32))))bad('custom NPC FGD definition is malformed.');
    }
    if(JSON.stringify(input.customNpcs).length>7_000_000)bad('embedded custom NPC source files exceed safe project size.');
  }
  if(input.surfaceSounds!==undefined){
    if(!record(input.surfaceSounds)||Object.keys(input.surfaceSounds).length>500||
       !Object.entries(input.surfaceSounds).every(([texture,code])=>/^[A-Z0-9_+~!{}*.$%-]{1,15}$/i.test(texture)&&
         typeof code==='string'&&/^[MVDSTGWPYFO]$/.test(code)))
       bad('custom material sound assignments are malformed.');
  }
  if(input.graphPositions!==undefined){
    if(!record(input.graphPositions)||Object.keys(input.graphPositions).length>100000||
       !Object.values(input.graphPositions).every(v=>Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1_000_000)))
      bad('graph positions are malformed.');
  }
  if(input.cinematicPreviewSpeeds!==undefined){
    if(!record(input.cinematicPreviewSpeeds)||Object.keys(input.cinematicPreviewSpeeds).length>1000||
       !Object.entries(input.cinematicPreviewSpeeds).every(([id,speed])=>id.length>0&&id.length<=256&&typeof speed==='number'&&Number.isFinite(speed)&&speed>=1&&speed<=2000))
      bad('cinematic preview speeds are malformed.');
  }
  if(input.terrainGroups!==undefined){
    if(!Array.isArray(input.terrainGroups)||input.terrainGroups.length>128)bad('terrain group collection is malformed.');
    const groupIds=new Set<string>();
    for(const [i,group] of input.terrainGroups.entries()){
      if(!record(group)||!str(group.id,256)||!str(group.name,96)||!vec3(group.origin)||
         typeof group.width!=='number'||typeof group.depth!=='number'||typeof group.resolution!=='number'||
         !Array.isArray(group.heights)||!group.heights.every(n=>typeof n==='number'&&Number.isFinite(n))||
         !str(group.texture,32)||!Array.isArray(group.brushIds)||!Array.isArray(group.brushSignatures)||
         group.brushIds.length!==2*group.resolution*group.resolution||
         group.brushSignatures.length!==group.brushIds.length||
         !group.brushIds.every(id=>str(id,256)&&ids.has(id))||
         !group.brushSignatures.every(signature=>str(signature,8192)))bad(`terrain group ${i+1} is malformed.`);
      if(![4,8,12,16].includes(group.resolution as number)||
         (group.width as number)<64||(group.width as number)>4096||
         (group.depth as number)<64||(group.depth as number)>4096||
         (group.width as number)/(group.resolution as number)<8||
         (group.depth as number)/(group.resolution as number)<8||
         group.heights.length!==((group.resolution as number)+1)**2||
         !group.heights.every(n=>n>=-512&&n<=512)||
         (group.baseDepth!==undefined&&(typeof group.baseDepth!=='number'||!Number.isFinite(group.baseDepth)||group.baseDepth<64||group.baseDepth>1024))||
         !/^[^\s\"()[\]]{1,32}$/.test(group.texture as string))bad(`terrain group ${i+1} has invalid geometry settings.`);
      if(groupIds.has(group.id))bad('duplicate terrain group ID.');
      groupIds.add(group.id);
    }
  }
  if(input.architectureLayouts!==undefined){
    if(!Array.isArray(input.architectureLayouts)||input.architectureLayouts.length>8192)bad('architecture layouts are malformed.');
    const layoutIds=new Set<string>();
    for(const [i,item] of input.architectureLayouts.entries()){
      if(!record(item)||!str(item.id,256)||!item.id||layoutIds.has(item.id)||
        !['walls','room'].includes(String(item.kind))||!Array.isArray(item.points)||
        item.points.length<2||item.points.length>48||
        !item.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=16384))||
        !record(item.options)||!str(item.texture,32)||!Array.isArray(item.memberIds)||!item.memberIds.length||
        item.memberIds.length>192||!item.memberIds.every(id=>str(id,256))||
        !Array.isArray(item.signatures)||item.signatures.length!==item.memberIds.length||
        !item.signatures.every(x=>str(x,64)))bad(`architecture layout ${i+1} is malformed.`);
      for(const key of ['baseZ','height','thickness','slab'])if(!optionalNumber(item.options[key]))bad(`architecture layout ${i+1} has invalid ${key}.`);
      if(!optionalBoolean(item.options.ceiling))bad(`architecture layout ${i+1} has invalid ceiling.`);
      layoutIds.add(item.id);
    }
  }
  if(input.architectureOpenings!==undefined){
    if(!Array.isArray(input.architectureOpenings)||input.architectureOpenings.length>8192)bad('architecture openings are malformed.');
    input.architectureOpenings.forEach(checkOpening);
  }
  if(input.architectureAssemblies!==undefined){
    if(!Array.isArray(input.architectureAssemblies)||input.architectureAssemblies.length>8192)bad('architecture assemblies are malformed.');
    const assemblyIds=new Set<string>();
    for(const [i,item] of input.architectureAssemblies.entries()){
      if(!record(item)||!str(item.id,256)||!item.id||assemblyIds.has(item.id)||
         !['frame','arch','stairs','ramp','column','room','corridor','platform','bridge','landingStairs'].includes(String(item.kind))||
         !vec3(item.origin)||!record(item.options)||!str(item.texture,32)||
         !Array.isArray(item.memberIds)||!item.memberIds.length||item.memberIds.length>512||
         !item.memberIds.every(v=>str(v,256))||
         !Array.isArray(item.signatures)||item.signatures.length!==item.memberIds.length||
         !item.signatures.every(v=>str(v,64)))bad(`architecture assembly ${i+1} is malformed.`);
      for(const key of ['width','height','depth','frame','steps'])if(!optionalNumber(item.options[key]))bad(`architecture assembly ${i+1} has invalid ${key}.`);
      for(const key of ['cutOnly','doorLeaf','openTop'])if(!optionalBoolean(item.options[key]))bad(`architecture assembly ${i+1} has invalid ${key}.`);
      assemblyIds.add(item.id);
    }
  }
  return {...input,target:'svengine'} as Project;
}
