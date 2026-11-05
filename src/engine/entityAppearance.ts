/** Cosmetic settings. Saved per browser, never serialized into Svengine .map. */
export const ENTITY_COLOR_KINDS=['spawn','light','npc','trigger','item','logic','other'] as const;
export type EntityColorKind=typeof ENTITY_COLOR_KINDS[number];
export type EntityAppearanceSettings={
  labelSize:number;
  opacity:number;
  markerSize:number;
  showClassname:boolean;
  showTargetname:boolean;
  alwaysShowSpawn:boolean;
  colors:Record<EntityColorKind,string>;
};
export const DEFAULT_ENTITY_APPEARANCE:EntityAppearanceSettings={
  labelSize:17,opacity:1,markerSize:1.35,showClassname:true,showTargetname:true,alwaysShowSpawn:true,
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
    markerSize:clamp(value.markerSize,.5,2.5,defaults.markerSize),
    showClassname:typeof value.showClassname==='boolean'?value.showClassname:defaults.showClassname,
    showTargetname:typeof value.showTargetname==='boolean'?value.showTargetname:defaults.showTargetname,
    alwaysShowSpawn:typeof value.alwaysShowSpawn==='boolean'?value.alwaysShowSpawn:defaults.alwaysShowSpawn,
    colors
  };
}
export function loadEntityAppearance():EntityAppearanceSettings{
  try{return normalizeEntityAppearance(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return structuredClone(DEFAULT_ENTITY_APPEARANCE)}
}
export function saveEntityAppearance(value:EntityAppearanceSettings){
  try{localStorage.setItem(KEY,JSON.stringify(normalizeEntityAppearance(value)))}catch{ /* blocked storage */ }
}
