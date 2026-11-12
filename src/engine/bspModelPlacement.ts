/** Native entity-lump placements for Sven Co-op MDL models.
 * Modes describe *engine entities*, not simulated physics or AI inside the browser.
 * Each edit is built atomically; compiled brush models are never transformed.
 */
import type {NativeBsp} from './bspNativeEdit';
import {nativeClassname,nativeProperty,removeNativeProperty} from './bspNativeEdit';
import {bspPointEditable,bspSetPointField} from './bspVisualEntityEdit';

export type BspModelPlacementMode='decoration'|'solid'|'npc'|'cycler';
export interface BspModelPlacementSettings {
  mode:BspModelPlacementMode;
  npcClassname:string;
  health:string;
  ally:boolean;
  roaming:'0'|'1'|'2';
  disableAI:boolean;
  weapons:string;
  spawnflags:string;
  customNpcHull:boolean;
  minHull:string;
  maxHull:string;
  sequenceName:string;
  sequenceNumber:string;
  skin:string;
  body:string;
  scale:string;
  displayname:string;
  targetname:string;
}
export interface BspModelEntitySpec {classname:string;properties:Record<string,string>;mode:BspModelPlacementMode;modelPath:string}

/** Suggest a native AI class only for known model families. Model names alone do
 * not confer AI, attacks or damage; unknown MDLs stay manual. */
export function bspRecommendedNpcClass(path:string,available:readonly string[]):string|null{
  const normalized=path.trim().replaceAll('\\','/').toLowerCase();
  const basename=normalized.split('/').at(-1)||'';
  const candidates:Record<string,string>={
    'agrunt.mdl':'monster_alien_grunt','hgrunt.mdl':'monster_human_grunt',
    'hgrunt_opfor.mdl':'monster_human_grunt','hgrunt_medic.mdl':'monster_human_grunt_ally',
    'hgrunt_torch.mdl':'monster_human_grunt_ally','zombie.mdl':'monster_zombie',
    'barney.mdl':'monster_barney','bullsquid.mdl':'monster_bullchicken',
    'headcrab.mdl':'monster_headcrab','houndeye.mdl':'monster_houndeye',
    'garg.mdl':'monster_gargantua','islave.mdl':'monster_alien_slave',
    'apache.mdl':'monster_apache','scientist.mdl':'monster_scientist'
  };
  const name=candidates[basename];
  return name&&available.includes(name)?name:null;
}

export const defaultBspModelSettings: BspModelPlacementSettings={
  mode:'decoration',npcClassname:'monster_generic',health:'0',ally:false,roaming:'0',disableAI:false,
  weapons:'0',spawnflags:'0',customNpcHull:false,minHull:'-16 -16 0',maxHull:'16 16 72',sequenceName:'',sequenceNumber:'',
  skin:'0',body:'0',scale:'1',displayname:'',targetname:''
};

function modelPath(path:string):string{
  const normalized=path.trim().replaceAll('\\','/');
  if(!/^models\/[a-z0-9_./() -]+\.mdl$/i.test(normalized)||normalized.includes('..')||normalized.includes('//')||normalized.length>240)
    throw Error('Select a valid model from the Sven Co-op library (models/... .mdl).');
  return normalized;
}
function intInRange(value:string,key:string,min:number,max:number):string{
  const v=value.trim();if(!/^-?\d+$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>max)
    throw Error(`${key}: expected an integer from ${min} to ${max}.`);
  return String(Number(v));
}
function plainText(value:string,key:string,max=80){
  const str=value.trim();if(str.length>max||/["\r\n\0]/.test(str)||[...str].some(c=>c.charCodeAt(0)>255))throw Error(`${key}: unsupported text or length.`);
  return str;
}
export function bspModelHull(value:string):[number,number,number]{
  const pieces=value.trim().split(/\s+/).map(Number);
  if(pieces.length!==3||!pieces.every(n=>Number.isFinite(n)&&Math.abs(n)<=512))throw Error('Collision hull must contain three numbers between -512 and 512.');
  return pieces as [number,number,number];
}
export function bspValidateModelHull(minText:string,maxText:string){
  const min=bspModelHull(minText),max=bspModelHull(maxText);
  if(min.some((value,i)=>value>=max[i]))throw Error('Collision hull minimum must be smaller than maximum on X, Y and Z.');
  return {min:min.join(' '),max:max.join(' ')};
}
/** Only known monster_* point classes may be selected; FGD classes are supplied by the editor. */
export function bspModelEntitySpec(path:string,settings:BspModelPlacementSettings,allowedNpcClassnames:readonly string[]=['monster_generic']):BspModelEntitySpec{
  const model=modelPath(path),mode=settings.mode;
  if(!(['decoration','solid','npc','cycler'] as string[]).includes(mode))throw Error('Unsupported BSP model placement mode.');
  const properties:Record<string,string>={model};
  const skin=intInRange(settings.skin,'skin',0,255),body=intInRange(settings.body,'body',0,65535);
  properties.skin=skin;properties.body=body;
  const targetname=plainText(settings.targetname,'targetname',64);
  if(targetname){if(!/^[A-Za-z0-9_.$-]+$/.test(targetname))throw Error('Targetname must be an ASCII identifier.');properties.targetname=targetname}
  if(mode==='decoration'||mode==='solid'){
    properties.solid=mode==='solid'?'2':'-1';
    properties.movetype='-1'; // stationary placement; never assume this is simulated by the viewer
    const scale=Number(settings.scale);
    if(!Number.isFinite(scale)||scale<.1||scale>8)throw Error('Model scale must be between 0.1 and 8.');
    properties.scale=String(Number(scale.toFixed(3)));
    const sequenceName=plainText(settings.sequenceName,'sequencename',64);
    if(sequenceName)properties.sequencename=sequenceName;
    if(settings.sequenceNumber.trim())properties.sequence=intInRange(settings.sequenceNumber,'sequence',0,4096);
    if(mode==='solid'){
      const hull=bspValidateModelHull(settings.minHull,settings.maxHull);
      properties.minhullsize=hull.min;properties.maxhullsize=hull.max;
    }
    return {classname:'item_generic',properties,mode,modelPath:model};
  }
  if(mode==='cycler'){
    // Sven Co-op cycler reacts to weapon impacts by advancing animation. This is NOT monster AI.
    return {classname:'cycler',properties,mode,modelPath:model};
  }
  const classname=settings.npcClassname.trim();
  if(!/^monster_[a-z0-9_]+$/i.test(classname)||!allowedNpcClassnames.some(cls=>cls.toLowerCase()===classname.toLowerCase()))
    throw Error('Choose a monster class supported by the loaded Sven Co-op FGD.');
  properties.health=intInRange(settings.health,'health',0,100000);
  properties.is_player_ally=settings.ally?'1':'0';
  properties.freeroam=settings.roaming;
  properties.spawnflags=intInRange(settings.spawnflags,'spawnflags',0,4294967295);
  if(settings.customNpcHull){
    const hull=bspValidateModelHull(settings.minHull,settings.maxHull);
    properties.minhullsize=hull.min;properties.maxhullsize=hull.max;
  }
  if(settings.disableAI&&classname==='monster_generic')properties.disableai='1';
  const displayname=plainText(settings.displayname,'displayname',80);
  if(displayname)properties.displayname=displayname;
  // Only native classes using the "weapons" key should receive a loadout.
  if(/^(monster_human_grunt|monster_human_grunt_ally|monster_male_assassin|monster_bodyguard)$/.test(classname))
    properties.weapons=intInRange(settings.weapons,'weapons',0,65535);
  // monster_generic supports a sequence index; real combat AI chooses its own sequences.
  if(classname==='monster_generic'&&settings.sequenceNumber.trim())
    properties.sequence=intInRange(settings.sequenceNumber,'sequence',0,4096);
  return {classname,properties,mode,modelPath:model};
}

export function bspCanConvertModelEntity(classname:string){return classname==='item_generic'||classname==='cycler'||/^monster_[a-z0-9_]+$/i.test(classname)}
const MODE_KEYS=new Set(['model','health','is_player_ally','freeroam','disableai','weapons','spawnflags',
  'solid','movetype','minhullsize','maxhullsize','sequencename','sequence','scale','skin','body','displayname']);

/** Convert an existing *point* model entity to a new behavior, leaving its origin, angles,
 * targetname (unless explicitly overridden), and unrelated keyvalues intact. */
export function bspConvertModelEntity(doc:NativeBsp,index:number,spec:BspModelEntitySpec):NativeBsp{
  const current=doc.entities[index];
  if(!bspPointEditable(current,index)||!bspCanConvertModelEntity(nativeClassname(current)))
    throw Error('Only editable MDL point entities can change placement mode.');
  // Verify the input spec was produced by our canonical engine builder, not arbitrary keyvalues.
  if(!/^models\//.test(spec.modelPath)||spec.properties.model!==spec.modelPath)throw Error('Invalid model conversion specification.');
  let next=doc;
  for(let pairIndex=current.pairs.length-1;pairIndex>=0;pairIndex--){
    if(MODE_KEYS.has(current.pairs[pairIndex].key))next=removeNativeProperty(next,index,pairIndex);
  }
  next=bspSetPointField(next,index,'classname',spec.classname);
  for(const [key,value] of Object.entries(spec.properties))next=bspSetPointField(next,index,key,value);
  // A targetname may be shared by other entities: do not erase it when not specified.
  return next;
}
