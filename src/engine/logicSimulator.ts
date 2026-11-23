/** v2.6 Logic simulator: a deterministic timeline of how Svengine would fire a chain of entities
 * (targets, delays, multi_manager, trigger_random, doors, counters, multisource masters,
 * trigger_changetarget…). Editor-only: the project is never modified. It explains the chain;
 * physics, AI and real player movement are not simulated. */
import type {MapObject,PointEntity} from './types';

export type LogicEvent={time:number;entityId:string|null;name:string;classname:string;action:string;detail:string;depth:number};
export type LogicResult={events:LogicEvent[];truncated:boolean;warnings:string[];duration:number};
const STD=new Set(['targetname','classname','origin','spawnflags','angles','angle','target','delay','killtarget','wait','speed','master','model']);
const num=(v:string|undefined,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};

/** Small deterministic RNG so trigger_random gives the same answer on every run of the same seed. */
function rng(seed:number){let s=seed>>>0||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

export function simulateLogic(objects:readonly MapObject[],startId:string,opts:{maxEvents?:number;maxTime?:number;seed?:number}={}):LogicResult{
  const maxEvents=opts.maxEvents??400,maxTime=opts.maxTime??120,random=rng(opts.seed??7);
  const ents=objects.filter((o):o is PointEntity=>o.kind==='entity');
  const byName=new Map<string,PointEntity[]>();for(const e of ents){const n=e.props.targetname?.trim();if(n)(byName.get(n)??byName.set(n,[]).get(n)!).push(e);}
  const target=new Map<string,string>(ents.map(e=>[e.id,e.props.target||'']));
  const killed=new Set<string>();const counters=new Map<string,number>();const onState=new Map<string,boolean>();const doorOpen=new Map<string,boolean>();
  const usedRandom=new Map<string,Set<number>>();
  const events:LogicEvent[]=[];const warnings:string[]=[];
  type Job={time:number;target:string;from:PointEntity|null;depth:number;mode:'fire'|'kill'};
  const queue:Job[]=[];
  const push=(e:Omit<LogicEvent,'depth'>&{depth?:number})=>{events.push({depth:0,...e});};
  const schedule=(time:number,name:string,from:PointEntity|null,depth:number,mode:Job['mode']='fire')=>{if(name&&time<=maxTime)queue.push({time,target:name,from,depth,mode});};
  // Masters: multisource is on when every entity targeting it has fired it (toggle).
  const sourcesOf=(ms:PointEntity)=>ents.filter(e=>e.props.target===ms.props.targetname||Object.keys(e.props).some(k=>!STD.has(k)&&e.classname==='multi_manager'&&k.replace(/#\d+$/,'')===ms.props.targetname));
  const masterOk=(e:PointEntity,time:number,depth:number)=>{
    const m=e.props.master?.trim();if(!m)return true;
    const ms=byName.get(m)?.[0];if(!ms){push({time,entityId:e.id,name:e.props.targetname||'',classname:e.classname,action:'blocked',detail:`master "${m}" does not exist`,depth});return false;}
    if(ms.classname==='multisource'){const ok=!!onState.get(ms.id);if(!ok)push({time,entityId:e.id,name:e.props.targetname||'',classname:e.classname,action:'blocked',detail:`master ${m} is not active yet`,depth});return ok;}
    return true;
  };
  const fireTargets=(e:PointEntity,time:number,depth:number)=>{
    const d=num(e.props.delay);const t=target.get(e.id)?.trim();
    if(t)schedule(time+d,t,e,depth+1);
    const k=e.props.killtarget?.trim();if(k)schedule(time+d,k,e,depth+1,'kill');
  };
  const activate=(e:PointEntity,time:number,depth:number,from:PointEntity|null)=>{
    if(killed.has(e.id))return;
    const name=e.props.targetname||'';const base={time,entityId:e.id,name,classname:e.classname,depth};
    const via=from?` ← ${from.props.targetname||from.classname}`:'';
    if(!masterOk(e,time,depth))return;
    switch(e.classname){
      case 'multi_manager':{
        push({...base,action:'manager',detail:`fires ${Object.keys(e.props).filter(k=>!STD.has(k)).length} targets${via}`});
        for(const [k,v] of Object.entries(e.props))if(!STD.has(k))schedule(time+num(v),k.replace(/#\d+$/,''),e,depth+1);
        return;}
      case 'trigger_random':case 'trigger_random_time':case 'trigger_random_unique':{
        const n=Math.max(1,Math.min(16,num(e.props.target_count,1)));const flags=num(e.props.spawnflags);
        const options=Array.from({length:n},(_,i)=>e.props[`target${i+1}`]||'').map((v,i)=>({v,i})).filter(o=>o.v);
        if(!options.length){push({...base,action:'random',detail:'no targets'});return;}
        let pool=options;if(flags&16||e.classname==='trigger_random_unique'){const used=usedRandom.get(e.id)??new Set();pool=options.filter(o=>!used.has(o.i));if(!pool.length){if(flags&4){used.clear();pool=options;}else{push({...base,action:'random',detail:'all outputs already used'});return;}}usedRandom.set(e.id,used);}
        const pick=pool[Math.floor(random()*pool.length)];usedRandom.get(e.id)?.add(pick.i);
        push({...base,action:'random',detail:`picked ${pick.v} (${pick.i+1}/${n})${via}`});schedule(time,pick.v,e,depth+1);
        if(flags&8){const lo=num(e.props.min_delay,3),hi=Math.max(lo,num(e.props.max_delay,7));const again=time+lo+random()*(hi-lo);if(!(flags&2))schedule(again,name,null,depth);}
        return;}
      case 'game_counter':{
        const c=(counters.get(e.id)??num(e.props.frags))+1;counters.set(e.id,c);const need=num(e.props.health,1);
        push({...base,action:'count',detail:`${c} / ${need}${via}`});
        if(c>=need){fireTargets(e,time,depth);if(!(num(e.props.spawnflags)&1))counters.set(e.id,0);}
        return;}
      case 'multisource':{
        const srcs=sourcesOf(e);const key=`${e.id}:${from?.id??'?'}`;const now=!onState.get(key);onState.set(key,now);
        const active=srcs.filter(s=>onState.get(`${e.id}:${s.id}`)).length;const all=srcs.length>0&&active>=srcs.length;onState.set(e.id,all);
        push({...base,action:'master',detail:`${active} / ${srcs.length} inputs on → ${all?'ACTIVE':'inactive'}`});
        if(all)fireTargets(e,time,depth);return;}
      case 'trigger_changetarget':{
        const t=e.props.target?.trim(),nt=e.props.m_iszNewTarget||'';for(const x of byName.get(t||'')??[])target.set(x.id,nt);
        push({...base,action:'retarget',detail:`${t}.target = "${nt}"${via}`});return;}
      case 'func_door':case 'func_door_rotating':case 'momentary_door':case 'func_water':{
        const open=!doorOpen.get(e.id);const speed=Math.max(1,num(e.props.speed,100));const travel=e.classname==='func_door_rotating'?num(e.props.distance,90)/speed:Math.max(.3,96/speed);
        doorOpen.set(e.id,open);push({...base,action:open?'open':'close',detail:`${travel.toFixed(1)} s${via}`});
        if(open){fireTargets(e,time+travel,depth);if(e.props.fireonopened)schedule(time+travel,e.props.fireonopened,e,depth+1);
          const w=num(e.props.wait,4);if(w>=0&&!(num(e.props.spawnflags)&32)){queue.push({time:time+travel+w,target:`\u0000close:${e.id}`,from:e,depth,mode:'fire'});}}
        return;}
      case 'func_button':case 'func_rot_button':case 'trigger_once':case 'trigger_multiple':case 'trigger_relay':case 'func_breakable':case 'func_tankcontrols':case 'func_pushable':{
        push({...base,action:e.classname==='func_breakable'?'break':e.classname.startsWith('trigger_')?'trigger':'press',detail:`target ${e.props.target||'—'}${num(e.props.delay)?` after ${num(e.props.delay)} s`:''}${via}`});
        fireTargets(e,time,depth);if(e.classname==='trigger_once')killed.add(e.id);return;}
      case 'ambient_generic':push({...base,action:'sound',detail:`${e.props.message||'(no file)'}${via}`});return;
      case 'game_text':push({...base,action:'text',detail:`"${(e.props.message||'').slice(0,80)}"${via}`});fireTargets(e,time,depth);return;
      case 'trigger_changelevel':push({...base,action:'level',detail:`→ ${e.props.map||'?'}${via}`});return;
      case 'game_end':push({...base,action:'end',detail:'game ends'});return;
      case 'env_explosion':case 'env_shake':case 'env_spark':case 'env_beam':case 'env_laser':case 'env_sprite':case 'env_shooter':case 'env_render':case 'env_fade':case 'env_blood':case 'env_bubbles':
        push({...base,action:'effect',detail:`${e.classname.replace('env_','')}${via}`});fireTargets(e,time,depth);return;
      case 'func_train':case 'func_tracktrain':push({...base,action:'move',detail:`starts / stops${via}`});return;
      case 'func_rotating':case 'func_pendulum':push({...base,action:'toggle',detail:`spins on/off${via}`});return;
      case 'monstermaker':case 'squadmaker':push({...base,action:'spawn',detail:`${e.props.monstertype||e.props.monstertype||'monster'}${via}`});fireTargets(e,time,depth);return;
      case 'scripted_sequence':push({...base,action:'script',detail:`${e.props.m_iszEntity||'?'} plays ${e.props.m_iszPlay||'(walk)'}${via}`});fireTargets(e,time+3,depth);return;
      case 'info_player_deathmatch':case 'info_player_start':push({...base,action:'spawn point',detail:`toggled${via}`});return;
      default:push({...base,action:'use',detail:`${e.classname}${via}`});fireTargets(e,time,depth);
    }
  };
  const start=ents.find(e=>e.id===startId);if(!start)return {events:[],truncated:false,warnings:['Choose an entity to start.'],duration:0};
  activate(start,0,0,null);
  let guard=0;
  while(queue.length&&events.length<maxEvents&&guard++<5000){
    queue.sort((a,b)=>a.time-b.time||a.depth-b.depth);const job=queue.shift()!;
    if(job.target.startsWith('\u0000close:')){const id=job.target.slice(7);const d=ents.find(e=>e.id===id);if(d&&doorOpen.get(id)){doorOpen.set(id,false);push({time:job.time,entityId:id,name:d.props.targetname||'',classname:d.classname,action:'close',detail:'auto-close (wait)',depth:job.depth});}continue;}
    if(job.target.startsWith('!'))continue;
    const list=byName.get(job.target);
    if(!list){push({time:job.time,entityId:null,name:job.target,classname:'?',action:'missing',detail:`nothing is named "${job.target}"${job.from?` ← ${job.from.props.targetname||job.from.classname}`:''}`,depth:job.depth});continue;}
    for(const e of list){
      if(job.mode==='kill'){killed.add(e.id);push({time:job.time,entityId:e.id,name:job.target,classname:e.classname,action:'removed',detail:'killtarget',depth:job.depth});}
      else activate(e,job.time,job.depth,job.from);
    }
  }
  const truncated=events.length>=maxEvents||queue.length>0;
  if(truncated)warnings.push('The chain keeps going (loop or long timer); the timeline was cut.');
  const missing=events.filter(e=>e.action==='missing').length;if(missing)warnings.push(`${missing} target(s) point to names that do not exist.`);
  return {events:events.slice(0,maxEvents),truncated,warnings,duration:events.length?events[events.length-1].time:0};
}
/** Entities that make sense as the start of a simulation. */
export const LOGIC_STARTERS=/^(func_button|func_rot_button|trigger_once|trigger_multiple|trigger_relay|multi_manager|trigger_random|trigger_auto|func_breakable|game_counter)$/;
