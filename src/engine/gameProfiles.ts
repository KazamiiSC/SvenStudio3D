import type {FgdClass,Project} from './types';
export type GameProfile = 'svengine' | 'cs16';
export const gameProfileName = (p:GameProfile)=>p==='cs16'?'Counter-Strike 1.6':'Sven Co-op';
/** Minimal offline catalogue. Full property types come from a user FGD or the local CS FGD. */
const csPoint:[string,string][]=[
 ['info_player_start','Counter-Terrorist spawn'],['info_player_deathmatch','Terrorist spawn'],
 ['info_bomb_target','Bomb target point'],['info_vip_start','VIP spawn'],['info_player_observer','Observer start'],
 ['hostage_entity','Hostage'],['info_hostage_rescue','Hostage rescue point'],
 ['armoury_entity','CS weapon equipment'],['game_player_equip','Player equipment'],
 ['light','Point light'],['light_environment','Sky light'],['ambient_generic','Sound'],
 ['env_sprite','Sprite'],['env_beam','Beam'],['info_target','Target'],
 ['info_teleport_destination','Teleport destination'],['path_corner','Train path corner']];
const csSolid:[string,string][]=[
 ['func_bomb_target','Bomb planting zone'],
 ['func_hostage_rescue','Hostage rescue zone'],['func_vip_safetyzone','VIP safety zone'],
 ['func_escapezone','Escape zone'],['func_buyzone','Buy zone (team property)'],
 ['func_door','Moving door'],['func_door_rotating','Rotating door'],
 ['func_button','Button'],['func_wall','Wall'],['func_breakable','Breakable'],
 ['func_train','Train'],['func_tracktrain','Track train'],['func_ladder','Ladder'],
 ['func_illusionary','Non-solid wall'],['func_water','Water'],
 ['trigger_once','One-shot trigger'],['trigger_multiple','Repeatable trigger'],
 ['trigger_hurt','Damage zone'],['trigger_teleport','Teleport']];
export const cs16StarterEntities:FgdClass[]=[
 ...csPoint.map(([name,description])=>({name,description,type:'point' as const,props:{}})),
 ...csSolid.map(([name,description])=>({name,description,type:'solid' as const,props:{}}))
];
export type CS16Diagnostic={code:string;message:string};
/** Advisory only: importing an existing CS map must never rewrite its native entities. */
export function inspectCS16Project(project:Pick<Project,'objects'>):CS16Diagnostic[]{
 const count=(name:string)=>project.objects.filter(o=>o.kind==='entity'&&o.classname.toLowerCase()===name).length;
 const entities=new Map(project.objects.filter(o=>o.kind==='entity').map(o=>[o.id,(o as {classname:string}).classname.toLowerCase()]));
 const brushCount=(name:string)=>project.objects.filter(o=>o.kind==='brush'&&!!o.entityId&&entities.get(o.entityId)===name).length;
 const ct=count('info_player_start'),t=count('info_player_deathmatch');
 const problems:CS16Diagnostic[]=[];
 if(ct===0)problems.push({code:'CS16_CT_SPAWN',message:'No Counter-Terrorist spawn (info_player_start).'});
 if(t===0)problems.push({code:'CS16_T_SPAWN',message:'No Terrorist spawn (info_player_deathmatch).'});
 if(project.objects.some(o=>o.position.some(v=>Math.abs(v)>4096)))problems.push({code:'CS16_BOUNDS',message:'Some objects lie beyond ±4096 units. Classic GoldSrc maps may exceed practical world limits.'});
 const unsupported=project.objects.filter(o=>o.kind==='entity'&&/^(monster_|squadmaker$|point_checkpoint$|path_waypoint$|info_hullshape$|info_compile_parameters$|trigger_script$|trigger_changevalue$)/i.test(o.classname));
 if(unsupported.length)problems.push({code:'CS16_SVEN_ONLY',message:`${unsupported.length} entity class(es) appear Sven Co-op-specific; replace or validate them in CS 1.6.`});
 if(ct>32||t>32)problems.push({code:'CS16_SPAWN_COUNT',message:'More than 32 spawns for one team; verify the intended server player limit.'});
 if(brushCount('func_bomb_target')&&!(count('info_player_start')&&count('info_player_deathmatch')))
  problems.push({code:'CS16_BOMB_SPAWN',message:'Bomb map needs valid spawns for both teams.'});
 return problems;
}
