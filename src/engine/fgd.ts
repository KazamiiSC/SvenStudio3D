import type {FgdClass} from './types';
/** Basic Sven Co-op FGD reader for PointClass, SolidClass and inherited BaseClass.
 * Resolves inherited keyvalues, choices and spawnflags without translating IDs.
 * The parser deliberately does not execute FGD includes or arbitrary directives.
 */
export function parseFgd(text:string):FgdClass[]{
  const source=text.replace(/\/\/[^\r\n]*/g,'');
  const header=/@(PointClass|SolidClass|BaseClass)\b([^=\[]*?)=\s*([a-zA-Z_][\w]*)\s*(?::\s*"([^"]*)")?\s*\[/gi;
  type Def={name:string;kind:string;description:string;bases:string[];studio?:string;props:FgdClass['props']};
  const definitions:Def[]=[];
  for(const match of source.matchAll(header)){
    let depth=1,index=(match.index||0)+match[0].length;
    const begin=index;
    for(;index<source.length;index++){
      if(source[index]==='[')depth++;
      else if(source[index]===']'&&--depth===0)break;
    }
    if(depth!==0)continue;
    const body=source.slice(begin,index);
    const base=match[2].match(/\bbase\s*\(([^)]*)\)/i);
    const bases=(base?.[1]||'').split(',').map(x=>x.trim()).filter(Boolean);
    const props:FgdClass['props']={};
    // Parse one top-level key at a time. Choice lists may span multiple lines.
    let nested=0,part='';
    const entries:string[]=[];
    for(const line of body.split(/\r?\n/)){
      const clean=line.trim();
      if(!clean)continue;
      if(nested===0&&part){entries.push(part);part=''}
      part+=(part?'\n':'')+clean;
      nested+=(clean.match(/\[/g)||[]).length-(clean.match(/\]/g)||[]).length;
      if(nested<=0){entries.push(part);part='';nested=0}
    }
    if(part)entries.push(part);
    for(const entry of entries){
      const f=entry.match(/^([\w$]+)\s*\(\s*([\w]+)\s*\)\s*(?::\s*"([^"]*)")?\s*(?::\s*("[^"]*"|[^:=\[\]\n]+))?/i);
      if(!f)continue;
      const type=f[2].toLowerCase();
      const def=f[4]?.trim().replace(/^"|"$/g,'');
      const field:FgdClass['props'][string]={label:f[3]||f[1],type,...(def!==undefined&&def!==''?{defaultValue:def}:{})};
      if(type==='choices'||type==='flags'){
        const block=entry.match(/=\s*\[([\s\S]*?)\]/);
        if(block){
          const options=[...block[1].matchAll(/^\s*("[^"]*"|[\d-]+)\s*:\s*"([^"]+)"(?:\s*:\s*([01]))?/gm)]
            .map(v=>({value:v[1].replace(/^"|"$/g,''),label:v[2],defaultOn:v[3]==='1'}));
          if(options.length)field.options=options;
          if(type==='flags'&&field.defaultValue===undefined){
            const defaultFlags=options.filter(x=>x.defaultOn).reduce((sum,o)=>sum+(Number(o.value)||0),0);
            field.defaultValue=String(defaultFlags);
          }
        }
      }
      props[f[1]]=field;
    }
    definitions.push({name:match[3],studio:match[2].match(/\bstudio\s*\(\s*"([^"]+)"/i)?.[1],kind:match[1].toLowerCase(),description:match[4]||match[3],bases,props});
  }
  const indexed=new Map(definitions.map(d=>[d.name.toLowerCase(),d]));
  const resolve=(d:Def,seen:Set<string>):FgdClass['props']=>{
    if(seen.has(d.name.toLowerCase()))return {...d.props};
    const visiting=new Set(seen);visiting.add(d.name.toLowerCase());
    return Object.assign({},...d.bases.map(base=>{const found=indexed.get(base.toLowerCase());return found?resolve(found,visiting):{}}),d.props);
  };
  return [...new Map(definitions.filter(d=>d.kind!=='baseclass').map(d=>{
    const cls:FgdClass={studio:d.studio,name:d.name,type:d.kind==='solidclass'?'solid':'point',description:d.description,props:resolve(d,new Set())};
    return [d.name.toLowerCase(),cls] as const;
  })).values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export const starterEntities:FgdClass[]=[
  ['info_player_start','Player start'],['light','Light'],['light_environment','Sun / sky light'],
  ['monster_human_grunt','Human Grunt'],['monster_zombie','Zombie'],['monster_barney','Barney'],
  ['weapon_crowbar','Crowbar'],['weapon_9mmhandgun','9mm Pistol'],['item_healthkit','Health kit'],['item_generic','Generic model prop'],
  ['func_healthcharger','Health charger'],['ambient_generic','Ambient sound'],['info_target','Target'],
  ['trigger_once','Trigger once'],['trigger_multiple','Trigger multiple'],['func_door','Door'],
  ['func_button','Button'],['func_wall','Wall entity'],['env_sprite','Sprite'],
  ['path_waypoint','Svengine NPC waypoint'],['path_corner','Train / legacy NPC waypoint'],['squadmaker','Squadmaker NPC spawner'],
  ['func_detail','Svengine detail brush'],['info_hullshape','Svengine custom collision hull'],
  ['info_compile_parameters','Svengine compile parameters'],['point_checkpoint','Sven Co-op checkpoint']
].map(([name,description])=>({name,description,type:(name.startsWith('func_')||name.startsWith('trigger_')||name==='info_hullshape')?'solid':'point',props:{}}));
