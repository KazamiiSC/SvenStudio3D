/** Defensive validation for imported Sven Studio project JSON.
 * Validate before replacing the editing session: never repair or discard objects silently.
 * This is intentionally a structural check, not a CSG validity check. Users must still
 * be able to open an editable map with a brush that Map Doctor needs to repair.
 */
import type {Face,MapObject,Project,Vec3} from './types';

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
     !record(value.wall)||!Array.isArray(value.memberIds)||value.memberIds.length>128||
     !value.memberIds.every(v=>str(v,256))||!vec3(value.center)||!record(value.options))
    bad(`architecture opening ${index+1} is malformed.`);
  const wall={...value.wall,kind:'brush'};checkObject(wall,index);
  for(const key of ['width','height','depth','frame','steps'])if(!optionalNumber(value.options[key]))bad(`architecture opening ${index+1} has invalid ${key}.`);
  for(const key of ['cutOnly','doorLeaf'])if(!optionalBoolean(value.options[key]))bad(`architecture opening ${index+1} has invalid ${key}.`);
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
  if(input.graphPositions!==undefined){
    if(!record(input.graphPositions)||Object.keys(input.graphPositions).length>100000||
       !Object.values(input.graphPositions).every(v=>Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1_000_000)))
      bad('graph positions are malformed.');
  }
  if(input.architectureOpenings!==undefined){
    if(!Array.isArray(input.architectureOpenings)||input.architectureOpenings.length>8192)bad('architecture openings are malformed.');
    input.architectureOpenings.forEach(checkOpening);
  }
  return {...input,target:'svengine'} as Project;
}
