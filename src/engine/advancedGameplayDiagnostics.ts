/** Editor-only diagnostics; intentionally does not pretend to simulate NPC AI.
 * Reports structural issues, not guaranteed in-game outcomes. */
import type {Project,PointEntity,Vec3} from './types';
import {encounterStartName,encounterFinishName,encounterIssues} from './npcEncounters';
import {puzzleIssues,puzzleDoneName} from './coopPuzzles';
import {missionGraph,missionIssues,eventTargetName,stageCompleteName,stageStartName,stageFailureName,cueIssues} from './missionEvents';
export type GameplayDiagnostic={severity:'error'|'warning'|'info';area:string;message:string;target?:string};
const dist=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function inspectAdvancedGameplay(project:Project):GameplayDiagnostic[]{
 const out:GameplayDiagnostic[]=[];
 const add=(severity:GameplayDiagnostic['severity'],area:string,message:string,target?:string)=>out.push({severity,area,message,target});
 const entities=project.objects.filter((o):o is PointEntity=>o.kind==='entity');
 const targets=new Map<string,PointEntity[]>();for(const e of entities){const n=e.props.targetname;if(n){const a=targets.get(n)||[];a.push(e);targets.set(n,a);}}
 const owners=new Set<string>([...(project.encounterPlans||[]).flatMap(p=>p.memberIds),...(project.puzzlePlans||[]).flatMap(p=>p.memberIds),...(project.missionPlans||[]).flatMap(p=>p.memberIds),...(project.eventSequences||[]).flatMap(p=>p.memberIds)]);
 for(const [n,es] of targets)if(es.length>1&&!es.every(e=>e.classname==='light'))add('warning','Entities',`Target '${n}' is shared by ${es.length} entities; confirm this is intentional.`,n);
 const edges=new Map<string,string[]>();
 for(const e of entities){const name=e.props.targetname;if(!name)continue;
  const refs=[e.props.target,e.props.killtarget,e.props.trigger_target].filter(Boolean);
  if(e.classname==='multi_manager')refs.push(...Object.keys(e.props).filter(k=>!['targetname','origin','spawnflags','classname','angles'].includes(k)).map(k=>k.replace(/#\d+$/,'')));
  const arr=edges.get(name)||[];edges.set(name,arr.concat(refs.filter(t=>targets.has(t))));
  for(const ref of refs)if(ref&&!targets.has(ref)&&!ref.startsWith('!')&&!owners.has(e.id))add('warning','Entities',`${e.classname} '${name}' targets missing '${ref}'.`,name);
 }
 for(const p of project.puzzlePlans||[]){const area=`Puzzle: ${p.name}`;
  for(const x of puzzleIssues(p,project))add(x.level,area,x.message,puzzleDoneName(p.id));
  if(!p.completionTarget&&!p.missionStageId&&!p.eventSequenceId)add('warning',area,'Puzzle announces success but is not linked to a door, mission or event.',puzzleDoneName(p.id));
 }
 for(const p of project.missionPlans||[]){const area=`Mission: ${p.name}`;for(const x of missionIssues(p,project))add(x.level,area,x.message);
  const graph=missionGraph(p);if(!graph.reachable.size)add('error',area,'Mission has no reachable objective.');
  for(const stage of p.stages){const finish=stageCompleteName(stage.id),entry=stageStartName(stage.id);
   const external=entities.filter(e=>!p.memberIds.includes(e.id)&&([e.props.target,e.props.trigger_target].includes(finish)||e.classname==='multi_manager'&&Object.keys(e.props).some(k=>k.replace(/#\d+$/,'')===finish)));
   if(!external.length)add('warning',area,`Objective '${stage.title}' has no external completion source. Connect a button, encounter or puzzle to ${finish}.`,finish);
   if(stage.failStageId||stage.failureOutput){const fail=stageFailureName(stage.id);if(!entities.some(e=>!p.memberIds.includes(e.id)&&e.props.target===fail))add('info',area,`Failure route for '${stage.title}' needs an external signal (${fail}).`,entry)}
  }
 }
 for(const e of project.eventSequences||[]){const area=`Events: ${e.name}`;for(const x of cueIssues(e.cues,project,e.id))add(x.level,area,x.message,eventTargetName(e.id));}
 for(const e of project.encounterPlans||[]){const area=`Encounter: ${e.name}`;
  for(const x of encounterIssues(e,project))add(x.level,area,x.message,encounterStartName(e.id));
  const alive=e.waves.reduce((s,w)=>s+w.maxLive,0),total=e.waves.reduce((s,w)=>s+w.count,0);
  if(total>40)add('warning',area,`${total} NPCs across waves: check entity budgets, corpse cleanup and FPS.`,encounterStartName(e.id));
  if(alive>32)add('info',area,`Configured ${alive} cumulative max-live across waves (not concurrent if waves gate correctly).`,encounterStartName(e.id));
  for(const [j,w] of e.waves.entries()){
   if(w.maxLive<w.count)add('info',area,`Wave ${j+1} uses max alive ${w.maxLive}/${w.count}: dead bodies may occupy slots until removed.`,encounterStartName(e.id));
   for(const [i,pos] of w.spawns.entries()){
    for(const other of w.spawns.slice(i+1))if(dist(pos,other)<56)add('warning',area,`Wave ${j+1} spawn points closer than 56 units.`,encounterStartName(e.id));
    for(const b of project.objects){if(b.kind!=='brush'||b.entityId||b.hidden)continue;
     const xs=b.vertices.map(v=>v[0]+b.position[0]),ys=b.vertices.map(v=>v[1]+b.position[1]),zs=b.vertices.map(v=>v[2]+b.position[2]);
     // Broad phase only; rotated convex brushes are approximated with their vertex AABB.
     if(Math.min(...xs)<pos[0]+18&&Math.max(...xs)>pos[0]-18&&Math.min(...ys)<pos[1]+18&&Math.max(...ys)>pos[1]-18&&Math.min(...zs)<pos[2]+72&&Math.max(...zs)>pos[2]-36){add('warning',area,`Wave ${j+1} spawn ${i+1} may overlap a solid brush (${b.name}). Check in 3D.`,encounterStartName(e.id));break;}
    }
   }
  }
  if(e.start==='manual'&&!entities.some(n=>!e.memberIds.includes(n.id)&&n.props.target===encounterStartName(e.id)))add('warning',area,'Manual start has no visible trigger entity.',encounterStartName(e.id));
  if(!e.missionStageId&&!e.completionTarget)add('warning',area,'Combat completion has no mission or gameplay output.',encounterFinishName(e.id));
 }
 return out.slice(0,300);
}
