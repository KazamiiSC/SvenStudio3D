/** Cosmetic settings. Saved per browser, never serialized into Svengine .map. */
export const ENTITY_COLOR_KINDS=['spawn','light','npc','trigger','item','logic','other'] as const;
export type EntityColorKind=typeof ENTITY_COLOR_KINDS[number];
export type EntityMarkerShape='box'|'bubble'|'capsule'|'diamond'|'cone';
export type EntityMarkerMode='automatic'|'uniform';
export type EntityMarkerKind=EntityMarkerShape|'light'|'door'|'button'|'speaker'|'relay'|'trigger'|'item';
export const ENTITY_MARKER_SHAPES:readonly EntityMarkerShape[]=['box','bubble','capsule','diamond','cone'];
export type EntityAppearanceSettings={
  labelSize:number;
  opacity:number;
  markerSize:number;
  markerShape:EntityMarkerShape;
  markerMode:EntityMarkerMode;
  markerOcclusion:'normal'|'xray';
  colorMode:'category'|'uniform';
  uniformColor:string;
  showClassname:boolean;
  showTargetname:boolean;
  alwaysShowSpawn:boolean;
  colors:Record<EntityColorKind,string>;
};
export const DEFAULT_ENTITY_APPEARANCE:EntityAppearanceSettings={
  labelSize:17,opacity:1,markerSize:.75,markerShape:'box',markerMode:'automatic',markerOcclusion:'xray',colorMode:'category',uniformColor:'#9baefa',showClassname:true,showTargetname:true,alwaysShowSpawn:true,
  colors:{spawn:'#00f58d',light:'#ffd54a',npc:'#ff5374',trigger:'#ff922e',item:'#37d8ff',logic:'#c783ff',other:'#a996ff'}
};
const KEY='svenstudio-entity-appearance-v1';
export function entityColorKind(classname:string):EntityColorKind{
  if(/^(info_player_|info_coop_)/i.test(classname))return 'spawn';
  if(/^light/i.test(classname))return 'light';
  if(/^(monster_|npc_)/i.test(classname))return 'npc';
  if(/^trigger_/i.test(classname))return 'trigger';
  if(/^(item_|weapon_|ammo_)/i.test(classname))return 'item';
  if(/^(multi_|game_|env_|logic_|path_|script_)/i.test(classname))return 'logic';
  return 'other';
}
export function isColorHex(value:string){return /^#[0-9a-f]{6}$/i.test(value)}
export function normalizeEntityAppearance(value:Partial<EntityAppearanceSettings>):EntityAppearanceSettings{
  const defaults=DEFAULT_ENTITY_APPEARANCE;
  const clamp=(v:number|undefined,min:number,max:number,base:number)=>Number.isFinite(v)?Math.max(min,Math.min(max,v!)):base;
  const colors={...defaults.colors};
  for(const kind of ENTITY_COLOR_KINDS){const candidate=value.colors?.[kind];if(candidate&&isColorHex(candidate))colors[kind]=candidate}
  return {
    labelSize:clamp(value.labelSize,11,30,defaults.labelSize),
    opacity:clamp(value.opacity,.35,1,defaults.opacity),
    markerSize:clamp(value.markerSize,.25,2.5,defaults.markerSize),
    markerShape:ENTITY_MARKER_SHAPES.includes(value.markerShape as EntityMarkerShape)?value.markerShape!:defaults.markerShape,
    markerMode:value.markerMode==='uniform'?'uniform':'automatic',
    markerOcclusion:value.markerOcclusion==='normal'?'normal':'xray',
    colorMode:value.colorMode==='uniform'?'uniform':'category',
    uniformColor:value.uniformColor&&isColorHex(value.uniformColor)?value.uniformColor:defaults.uniformColor,
    showClassname:typeof value.showClassname==='boolean'?value.showClassname:defaults.showClassname,
    showTargetname:typeof value.showTargetname==='boolean'?value.showTargetname:defaults.showTargetname,
    alwaysShowSpawn:typeof value.alwaysShowSpawn==='boolean'?value.alwaysShowSpawn:defaults.alwaysShowSpawn,
    colors
  };
}
export function loadEntityAppearance():EntityAppearanceSettings{
  try{
    const stored=JSON.parse(localStorage.getItem(KEY)||'{}') as Partial<EntityAppearanceSettings>;
    // Existing installations stored 135% as their former default. Migrate it
    // only once when the markerShape setting is first introduced.
    if(!stored.markerShape){stored.markerSize=Number.isFinite(stored.markerSize)?stored.markerSize!* (.75/1.35):.75;stored.markerShape='box'}
    return normalizeEntityAppearance(stored);
  }catch{return structuredClone(DEFAULT_ENTITY_APPEARANCE)}
}
export function saveEntityAppearance(value:EntityAppearanceSettings){
  try{localStorage.setItem(KEY,JSON.stringify(normalizeEntityAppearance(value)))}catch{ /* blocked storage */ }
}

/** Dedicated shapes for frequent FGD classes; unknown classes use the global fallback.
 * Marker mapping is visual-only and does not create Svengine entities/brushes. */
export function automaticEntityMarkerKind(classname:string):EntityMarkerKind|null{
  const name=classname.toLowerCase();
  if(name==='light'||name==='light_spot'||name==='light_environment')return 'light';
  if(name==='func_door'||name==='func_door_rotating'||name==='func_train'||name==='func_plat')return 'door';
  if(name==='func_button'||name==='func_rot_button'||name==='momentary_rot_button'||name==='button_target')return 'button';
  if(name==='info_player_start'||name.startsWith('info_player_')||name.startsWith('info_coop_'))return 'capsule';
  if(name==='ambient_generic'||name==='ambient_music'||name==='env_sound')return 'speaker';
  if(name==='trigger_relay'||name==='multi_manager')return 'relay';
  if(name.startsWith('trigger_'))return 'trigger';
  if(name.startsWith('monster_')||name.startsWith('npc_'))return 'capsule';
  if(name.startsWith('item_')||name.startsWith('weapon_')||name.startsWith('ammo_'))return 'item';
  return null;
}
export function markerKindForEntity(classname:string,settings:EntityAppearanceSettings):EntityMarkerKind{
  return settings.markerMode==='uniform'?settings.markerShape:(automaticEntityMarkerKind(classname)||settings.markerShape);
}
export function markerColorForEntity(classname:string,settings:EntityAppearanceSettings):string{
  return settings.colorMode==='uniform'?settings.uniformColor:settings.colors[entityColorKind(classname)];
}
