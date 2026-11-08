/** GoldSrc / Sven Co-op material helpers. Browser-only state is never emitted as
 * fictitious MAP keyvalues. Brush entity settings are genuine native keys. */
import type {Brush,MapObject,PointEntity,Project,Vec3} from './types';
import {validateTextureName} from './advancedLighting.ts';

export const SURFACE_PRESETS={
 glass:{label:'Translucent glass',classname:'func_wall',mode:'2',amount:180,description:'Texture mode (not baked-lit), transparent brush entity.'},
 grate:{label:'Cutout grate / fence',classname:'func_wall',mode:'4',amount:255,description:'Solid mode requires { WAD textures with a transparent palette index.'},
 additive:{label:'Additive display',classname:'func_illusionary',mode:'5',amount:180,description:'Additive blend, non-solid overlay. Does not create light.'},
 water:{label:'Water',classname:'func_water',mode:'2',amount:180,description:'Requires ! liquid textures and a cuboid brush; check placement in Sven Co-op.'},
} as const;
export type SurfacePresetId=keyof typeof SURFACE_PRESETS;
export type SurfaceRenderOptions={amount:number;color:[number,number,number];texture?:string;paintAll?:boolean;waveHeight?:number};
export const SURFACE_CODES={M:'Metal',V:'Ventilation',D:'Dirt',S:'Slosh / liquid',T:'Tile',G:'Grate',W:'Wood',P:'Computer',Y:'Glass',F:'Flesh',O:'Snow'} as const;
export type SurfaceSoundCode=keyof typeof SURFACE_CODES;
export type SurfaceSoundMap=Record<string,SurfaceSoundCode>;
const textureKey=(value:string)=>value.trim().toUpperCase();
const asciiTexture=/^[A-Z0-9_+~!{}*.$%-]{1,15}$/;
const safeMapName=/^[a-zA-Z0-9_-]{1,48}$/;

export function materialSoundPath(mapName:string):string{
 if(!safeMapName.test(mapName))throw Error('Map name must be 1–48 ASCII letters, numbers, underscores or hyphens.');
 return `sound/${mapName}/${mapName}_materials.txt`;
}
function checkTexture(value:string):string{
 const name=textureKey(value);
 if(!asciiTexture.test(name)||validateTextureName(name))throw Error('Select a valid existing WAD texture name (1–15 ASCII characters).');
 return name;
}
function checkColor(options:SurfaceRenderOptions){
 if(!Number.isInteger(options.amount)||options.amount<1||options.amount>255)throw Error('Render amount must be an integer from 1 to 255.');
 if(options.color.length!==3||options.color.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Each RGB channel must be an integer from 0 to 255.');
 if(options.waveHeight!==undefined&&(!Number.isFinite(options.waveHeight)||options.waveHeight<0||options.waveHeight>128))throw Error('Wave height must be between 0 and 128.');
}
/** No geometry/UV changes. Changes one or several world brushes atomically.
 * Linked multi-brush entities are never silently edited or separated. */
export function applySurfacePreset(project:Project,brushIds:readonly string[],preset:SurfacePresetId,options:SurfaceRenderOptions,createId:()=>string):Project{
 const spec=SURFACE_PRESETS[preset];if(!spec)throw Error('Unsupported native surface preset.');
 checkColor(options);
 const ids=[...new Set(brushIds)];if(!ids.length)throw Error('Select at least one brush.');
 const byId=new Map(project.objects.map(o=>[o.id,o]));
 const linked=new Map<string,{brush:Brush;entity?:PointEntity}>();
 const texture=options.paintAll?checkTexture(options.texture||''):null;
 for(const id of ids){
  const brush=byId.get(id);
  if(!brush||brush.kind!=='brush'||brush.locked||brush.hidden)throw Error(`Brush ${id} is unavailable, hidden or locked.`);
  if(preset==='water'&&brush.primitive!=='box')throw Error('func_water requires a cuboid brush. Select a Box.');
  const faces=texture?brush.faces.map(f=>({...f,texture})):brush.faces;
  if(preset==='grate'&&!faces.some(f=>f.texture.startsWith('{')))throw Error('Solid grates need at least one { transparent WAD texture. Enable Paint all faces or select the correct texture.');
  if(preset==='water'&&faces.some(f=>!f.texture.startsWith('!')))throw Error('Water requires ! liquid textures on every face. Enable Paint all faces and select one.');
  const parent=brush.entityId?byId.get(brush.entityId):undefined;
  if(brush.entityId&&(!parent||parent.kind!=='entity'))throw Error('Missing linked brush entity.');
  if(parent?.kind==='entity'){
   if(parent.classname!==spec.classname)throw Error(`Brush belongs to ${parent.classname}. Detach it first; this tool will not replace existing game logic.`);
   const count=project.objects.filter(o=>o.kind==='brush'&&o.entityId===parent.id).length;
   if(count!==1)throw Error(`Entity ${parent.classname} owns ${count} brushes. Split/detach them before applying an individual surface preset.`);
   if(parent.locked||parent.hidden)throw Error('Linked entity is locked or hidden.');
  }
  linked.set(id,{brush: {...brush,faces},entity:parent?.kind==='entity'?parent:undefined});
 }
 const newEntities:PointEntity[]=[];
 const updated=new Map<string,MapObject>();
 const usedIds=new Set(project.objects.map(o=>o.id));
 for(const {brush,entity} of linked.values()){
  let parent=entity;
  if(!parent){
   const id=createId();if(usedIds.has(id)||!id)throw Error('Duplicate generated entity ID.');usedIds.add(id);
   const position:Vec3=[...brush.position];
   parent={id,kind:'entity',name:spec.classname,classname:spec.classname,position,props:{},layer:'Materials'};
   newEntities.push(parent);
  }
  const props:Record<string,string>={...parent.props,rendermode:spec.mode,renderamt:String(options.amount),rendercolor:options.color.join(' ')};
  if(preset==='water')props.WaveHeight=String(options.waveHeight??1);
  updated.set(parent.id,{...parent,props});
  updated.set(brush.id,{...brush,entityId:parent.id});
 }
 return {...project,objects:[...project.objects.map(o=>updated.get(o.id)||o),...newEntities.map(e=>updated.get(e.id) as PointEntity||e)]};
}

/** Store exact WAD texture names, but warn about material lookup aliases (first 12 chars). */
export function setSurfaceSound(project:Project,texture:string,code:SurfaceSoundCode|null):Project{
 const name=checkTexture(texture);
 if(code!==null&&!Object.prototype.hasOwnProperty.call(SURFACE_CODES,code))throw Error('Unknown Sven Co-op material sound code.');
 const surfaceSounds:{[name:string]:SurfaceSoundCode}={...(project.surfaceSounds||{})};
 if(code===null)delete surfaceSounds[name];else surfaceSounds[name]=code;
 return {...project,surfaceSounds};
}
/** SvenCoop material lookup strips +0 animation / ~ prefixes and compares
 * the first 12 base characters; reject conflicting material definitions. */
export function materialLookupKey(texture:string):string{
 return textureKey(texture).replace(/^(?:[+-][0-9A-J]|~)/,'').slice(0,12);
}
export function inspectSurfaceSounds(sounds:SurfaceSoundMap):string[]{
 const errors:string[]=[];const keys=new Map<string,SurfaceSoundCode>();
 for(const [texture,code] of Object.entries(sounds)){
  try{checkTexture(texture)}catch{errors.push(`Invalid WAD texture: ${texture}`);continue;}
  if(!(code in SURFACE_CODES)){errors.push(`Unknown material code for ${texture}`);continue;}
  const alias=materialLookupKey(texture),prior=keys.get(alias);
  if(prior&&prior!==code)errors.push(`${texture}: first 12 characters collide with another material assignment (${alias}).`);
  keys.set(alias,code);
 }
 if(Object.keys(sounds).length>450)errors.push('Too many custom surface sounds: recommended limit is 450 (the game has a shared ~2048-entry cap).');
 return errors;
}
/** All ASCII for legacy Sven Co-op material file compatibility (ANSI). */
export function generateSurfaceMaterialsTxt(sounds:SurfaceSoundMap):string{
 const problems=inspectSurfaceSounds(sounds);if(problems.length)throw Error(problems.join('\n'));
 return Object.entries(sounds).sort(([a],[b])=>a.localeCompare(b,'en')).map(([tex,code])=>`${code} ${textureKey(tex)}`).join('\r\n')+'\r\n';
}
export function linkSurfaceMaterialFile(project:Project,mapName:string):Project{
 if(!Object.keys(project.surfaceSounds||{}).length)throw Error('Assign at least one material sound before linking the file.');
 const errors=inspectSurfaceSounds(project.surfaceSounds||{});if(errors.length)throw Error(errors.join('\n'));
 return {...project,world:{...project.world,materials_file:materialSoundPath(mapName)}};
}
export function surfaceMaterialDoctor(project:Project,loadedTextures:readonly string[]):string[]{
 const problems:string[]=[];
 const available=new Set(loadedTextures.map(textureKey));
 const used=new Set(project.objects.filter((o):o is Brush=>o.kind==='brush').flatMap(b=>b.faces.map(f=>textureKey(f.texture))));
 for(const o of project.objects){
  if(o.kind!=='brush'||!o.entityId)continue;
  const linked=project.objects.find(e=>e.id===o.entityId);
  if(!linked||linked.kind!=='entity')continue;
  const classname=linked.classname;
  if(classname==='func_water'&&o.faces.some(f=>!f.texture.startsWith('!')))problems.push(`${o.name}: func_water needs ! liquid textures.`);
  if(linked.props.rendermode==='4'&&o.faces.some(f=>!f.texture.startsWith('{')))problems.push(`${o.name}: Solid uses { transparent textures.`);
  if(linked.props.rendermode==='2'||linked.props.rendermode==='5')problems.push(`${o.name}: ${classname} render mode ${linked.props.rendermode} does not use baked lighting.`);
 }
 for(const tex of Object.keys(project.surfaceSounds||{})){
  if(!used.has(textureKey(tex)))problems.push(`${tex}: sound mapping is not used in this MAP.`);
  if(available.size>0&&!available.has(textureKey(tex)))problems.push(`${tex}: texture is missing from the currently imported WADs.`);
 }
 problems.push(...inspectSurfaceSounds(project.surfaceSounds||{}));
 if(Object.keys(project.surfaceSounds||{}).length&&!project.world.materials_file)problems.push('Custom material sounds have no worldspawn materials_file key. Download/install the txt and link it.');
 return [...new Set(problems)];
}
export type TextureAnimationGroup={base:string;regular:string[];alternate:string[];missing:string[]};
/** Animation prefix conventions are generated by WAD assets, not by shaders. */
export function inspectTextureAnimations(textures:readonly string[]):TextureAnimationGroup[]{
 const groups=new Map<string,{regular:Set<string>;alternate:Set<string>}>();
 for(const name of textures){
  const upper=textureKey(name);if(!/^\+[0-9A-J][A-Z0-9_+~!{}*.$%-]{1,13}$/.test(upper))continue;
  const base=upper.slice(2);const obj=groups.get(base)||{regular:new Set(),alternate:new Set()};
  (/[0-9]/.test(upper[1])?obj.regular:obj.alternate).add(upper[1]);groups.set(base,obj);
 }
 return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([base,{regular,alternate}])=>{
  const findMissing=(chars:string[],prefix:string)=>{
   const last=Math.max(-1,...chars.map(c=>prefix.indexOf(c)));
   return [...prefix.slice(0,last+1)].filter(c=>!chars.includes(c));
  };
  const reg=[...regular].sort(),alt=[...alternate].sort();
  return {base,regular:reg,alternate:alt,missing:[...findMissing(reg,'0123456789').map(frame=>`+${frame}${base}`),...findMissing(alt,'ABCDEFGHIJ').map(frame=>`+${frame}${base}`)]};
 });
}

/** Reuses the existing native light_surface logic; does not simulate emission. */
export function addEmissiveSurface(project:Project,brushId:string,texture:string,brightness:number,createId:()=>string):Project{
 const brush=project.objects.find(o=>o.id===brushId);
 if(!brush||brush.kind!=='brush'||brush.locked||brush.hidden)throw Error('Select an unlocked visible brush to add emission.');
 const name=checkTexture(texture);
 if(!brush.faces.some(f=>textureKey(f.texture)===name))throw Error('Select a texture currently used on the brush; emission matches textures in SC-RAD.');
 if(project.objects.some(o=>o.kind==='entity'&&o.classname==='light_surface'&&textureKey(o.props._tex||'')===name))
  throw Error('This texture already has a light_surface entity. Edit it in Lighting Studio to prevent doubled emission.');
 if(project.objects.some(o=>o.kind==='entity'&&o.classname==='info_texlights'&&Object.keys(o.props).some(key=>textureKey(key)===name)))
  throw Error('This texture already emits light via info_texlights. Edit it in Lighting Studio to avoid doubled emission.');
 if(!Number.isFinite(brightness)||brightness<=0||brightness>100000)throw Error('Brightness must be 1–100000.');
 const id=createId();if(project.objects.some(o=>o.id===id))throw Error('Duplicate entity ID.');
 const entity:PointEntity={id,kind:'entity',name:'light_surface',classname:'light_surface',position:[...brush.position],layer:'Lighting',props:{_tex:name,_light:`255 255 255 ${Math.round(brightness)}`}};
 return {...project,objects:[...project.objects,entity]};
}
