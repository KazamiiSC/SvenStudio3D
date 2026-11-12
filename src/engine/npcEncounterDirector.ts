/** Planning estimates; these are not NPC AI or runtime spawn-state simulation. */
import type {Project} from './types';
import type {EncounterPlan} from './npcEncounters';
export type WaveEstimate={index:number;count:number;maximumAlive:number;spawnerCount:number;nominalSeconds:number;warnings:string[]};
export type DirectorReport={total:number;peakAlive:number;estimatedSpawnSeconds:number;waves:WaveEstimate[];warnings:string[]};
export function analyzeEncounterDirector(p:EncounterPlan,project:Project):DirectorReport{
 const warnings:string[]=[];
 const waves=p.waves.map((w,i)=>{
  const available=Math.min(w.count,w.maxLive,w.spawns.length),spawnerCount=Math.max(1,available),nominalSeconds=Math.max(0,Math.ceil(w.count/spawnerCount)-1)*w.delay;
  const risk:string[]=[];
  if(w.count>w.maxLive)risk.push('Spawn pool can stall until dead bodies despawn; this is not a death counter error.');
  if(w.count>w.spawns.length*6)risk.push('Many NPCs share few spawn points; check clearance and collision.');
  if(w.monster==='monster_barnacle'||w.monster==='monster_turret')risk.push('Special monsters may not behave like walking enemies; test combat positions.');
  if(w.ally)risk.push('Allied NPCs may not be killed by players; mission completion still requires death signals.');
  if(w.pathName&&!project.objects.some(o=>o.kind==='entity'&&o.props.targetname===w.pathName))risk.push(`Path ${w.pathName} does not exist.`);
  return {index:i,count:w.count,maximumAlive:w.maxLive,spawnerCount,nominalSeconds,warnings:risk};
 });
 const total=waves.reduce((n,w)=>n+w.count,0),peakAlive=Math.max(0,...waves.map(w=>w.maximumAlive));
 if(total>60)warnings.push('Heavy encounter: use lower simultaneous counts and test server performance.');
 if(p.start==='manual'&&!project.objects.some(o=>o.kind==='entity'&&o.props.target===`sv_en_${p.id.replace(/[^a-zA-Z0-9]/g,'').slice(0,19)}_start`))warnings.push('Manual start needs an external trigger (such as a puzzle output).');
 return {total,peakAlive,estimatedSpawnSeconds:waves.reduce((n,w)=>n+w.nominalSeconds,0),waves,warnings};
}
