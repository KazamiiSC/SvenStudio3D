/** Co-op Puzzle Builder. Native entities only: func_button, game_counter,
 * multisource and trigger_relay. No promise of distinct-player detection. */
import {createBrush} from './geometry';
import {uid,type Brush,type MapObject,type PointEntity,type Project,type Vec3} from './types';
import {eventTargetName,stageCompleteName,signature,namePattern} from './missionEvents';
export type PuzzleMode='switches'|'simultaneous';
export type PuzzlePlan={id:string;name:string;description:string;mode:PuzzleMode;origin:Vec3;buttons:Vec3[];window:number;completionTarget:string;missionStageId:string;eventSequenceId:string;memberIds:string[];signatures:string[]};
export type PuzzleIssue={level:'error'|'warning';message:string};
const sid=(s:string)=>/^[A-Za-z0-9_-]{1,64}$/.test(s);
const validVec=(v:Vec3)=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=131072);
const text=(v:string,len:number)=>typeof v==='string'&&v.length>0&&v.length<=len&&!/["\\\r\n\x00-\x1f]/.test(v);
export const puzzlePrefix=(id:string)=>`sv_pz_${id.replace(/[^A-Za-z0-9]/g,'').slice(0,19)}`;
export const puzzleStartName=(id:string)=>`${puzzlePrefix(id)}_gate`;
export const puzzleDoneName=(id:string)=>`${puzzlePrefix(id)}_done`;
export const puzzleButtonName=(id:string,index:number)=>`${puzzlePrefix(id)}_sw${index+1}`;
export const puzzleLogicName=(id:string)=>`${puzzlePrefix(id)}_logic`;
const generatedNames=(p:PuzzlePlan)=>[puzzleStartName(p.id),puzzleDoneName(p.id),puzzleLogicName(p.id),`${puzzlePrefix(p.id)}_hud`,...p.buttons.map((_,i)=>puzzleButtonName(p.id,i))];
export function createPuzzlePreset(mode:PuzzleMode='switches',origin:Vec3=[0,0,0]):PuzzlePlan{
 const id=uid();return {id,name:mode==='switches'?'Restore power':'Dual access control',description:mode==='switches'?'Activate every console once to restore power.':'Press the consoles while their signals overlap.',mode,origin:[...origin],buttons:[[origin[0]-72,origin[1],origin[2]+64],[origin[0]+72,origin[1],origin[2]+64]],window:5,completionTarget:'',missionStageId:'',eventSequenceId:'',memberIds:[],signatures:[]};
}
export function duplicatePuzzle(plan:PuzzlePlan):PuzzlePlan{const id=uid();return {...plan,id,name:`${plan.name} (copy)`.slice(0,100),origin:[plan.origin[0]+256,...plan.origin.slice(1)] as Vec3,buttons:plan.buttons.map(v=>[v[0]+256,v[1],v[2]] as Vec3),memberIds:[],signatures:[]};}
const isEntity=(o:MapObject):o is PointEntity=>o.kind==='entity';
const puzzleSignature=(o:MapObject)=>JSON.stringify([signature(o),o.kind==='brush'?[o.rotation,o.scale,o.group,o.layer]:[o.layer,o.group]]);
const externalNames=(project:Project,exclude:Set<string>)=>new Set(project.objects.filter(o=>isEntity(o)&&!exclude.has(o.id)).map(o=>(o as PointEntity).props.targetname).filter(Boolean));
export function puzzleIssues(plan:PuzzlePlan,project:Project):PuzzleIssue[]{
 const issues:PuzzleIssue[]=[];const error=(message:string)=>issues.push({level:'error',message});const warn=(message:string)=>issues.push({level:'warning',message});
 if(!sid(plan.id)||!text(plan.name,100)||typeof plan.description!=='string'||plan.description.length>500)error('Invalid puzzle ID, title or description.');
 if(!['switches','simultaneous'].includes(plan.mode))error('Unknown puzzle type.');
 if(!validVec(plan.origin)||!Array.isArray(plan.buttons)||plan.buttons.length<2||plan.buttons.length>6||!plan.buttons.every(validVec))error('Place 2–6 buttons at valid XYZ coordinates.');
 if(!Number.isFinite(plan.window)||plan.window<1||plan.window>30)error('Simultaneous window must be 1–30 seconds.');
 if(plan.buttons.some((a,i)=>plan.buttons.some((b,j)=>i!==j&&Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<30)))error('Buttons overlap. Keep their centers at least 30 units apart.');
 else if(plan.buttons.some((a,i)=>plan.buttons.some((b,j)=>i!==j&&Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<56)))warn('Buttons are very close; check their accessibility in 3D.');
 if(plan.completionTarget&&!namePattern.test(plan.completionTarget))error('Invalid external output targetname.');
 if(plan.missionStageId&&!project.missionPlans?.some(m=>m.stages.some(s=>s.id===plan.missionStageId)))error('Mission objective no longer exists.');
 if(plan.eventSequenceId&&!project.eventSequences?.some(e=>e.id===plan.eventSequenceId))error('Dynamic Events sequence no longer exists.');
 if(plan.eventSequenceId&&project.eventSequences?.some(e=>e.id===plan.eventSequenceId&&e.cues.some(c=>c.target===puzzleDoneName(plan.id)||c.target===puzzleLogicName(plan.id))))error('Linked event sequence would trigger the puzzle recursively.');
 const old=project.puzzlePlans?.find(p=>p.id===plan.id);const outside=externalNames(project,new Set(old?.memberIds||[]));
 for(const n of generatedNames(plan))if(outside.has(n))error(`Generated targetname collides with '${n}'.`);
 if(plan.completionTarget&&generatedNames(plan).includes(plan.completionTarget))error('Completion cannot target its own generated entities.');
 if(plan.completionTarget&&!outside.has(plan.completionTarget))warn(`Output '${plan.completionTarget}' has no matching map entity yet.`);
 const outputs=[plan.completionTarget,plan.missionStageId?stageCompleteName(plan.missionStageId):'',plan.eventSequenceId?eventTargetName(plan.eventSequenceId):''].filter(Boolean);
 if(new Set(outputs).size!==outputs.length)warn('Multiple puzzle outputs refer to the same target. They will only fire once.');
 return issues;
}
const pt=(cls:string,name:string,at:Vec3,props:Record<string,string>,group:string):PointEntity=>({id:uid(),kind:'entity',name:cls,classname:cls,position:[...at],props:{targetname:name,...props},group,layer:'Gameplay Puzzles'});
export function buildPuzzleObjects(plan:PuzzlePlan):MapObject[]{
 const group=`Puzzle: ${plan.name}`,out:MapObject[]=[];const add=(cls:string,name:string,at:Vec3,props:Record<string,string>)=>{const e=pt(cls,name,at,props,group);out.push(e);return e};
 const gate=puzzleStartName(plan.id),done=puzzleDoneName(plan.id),logic=puzzleLogicName(plan.id);
 // Physical buttons are independent, non-overlapping brush entities, no hidden scripting.
 plan.buttons.forEach((at,i)=>{
  const e=add('func_button',puzzleButtonName(plan.id,i),at,{target:logic,wait:plan.mode==='switches'?'-1':String(plan.window),spawnflags:'1',sounds:'3',use_type:'3'});
  const b:Brush=createBrush('box',at,[28,14,32],`Puzzle console ${i+1}`);b.entityId=e.id;b.group=group;b.layer='Gameplay Puzzles';b.faces=b.faces.map(f=>({...f,texture:'SV_METAL01'}));out.push(b);
 });
 if(plan.mode==='switches')add('game_counter',logic,[plan.origin[0],plan.origin[1],plan.origin[2]+144],{frags:'0',health:String(plan.buttons.length),target:done,spawnflags:'1'});
 else {
  add('multisource',logic,[plan.origin[0],plan.origin[1],plan.origin[2]+144],{target:gate});
  add('trigger_relay',gate,[plan.origin[0]+32,plan.origin[1],plan.origin[2]+144],{target:done,triggerstate:'1',spawnflags:'1'});
 }
 const msg=`${plan.name.toUpperCase()}: ACCESS GRANTED`.replace(/[^A-Za-z0-9 :!.,_-]/g,' ').slice(0,130);
 const hud=`${puzzlePrefix(plan.id)}_hud`;
 add('game_text',hud,[plan.origin[0],plan.origin[1],plan.origin[2]+176],{message:msg,x:'-1',y:'0.26',holdtime:'4',fadein:'0.3',fadeout:'0.8',color:'100 240 190',channel:'3'});
 const outputs:Record<string,string>={[hud]:'0'};
 for(const name of [plan.completionTarget,plan.missionStageId?stageCompleteName(plan.missionStageId):'',plan.eventSequenceId?eventTargetName(plan.eventSequenceId):''])if(name)outputs[name]='0.1';
 add('multi_manager',done,[plan.origin[0]+64,plan.origin[1],plan.origin[2]+176],outputs);
 return out;
}
/** Block accidental orphaned external entity links and edits to generated pieces. */
function assertIntact(project:Project,plan:PuzzlePlan){for(let i=0;i<plan.memberIds.length;i++){
 const o=project.objects.find(o=>o.id===plan.memberIds[i]);if(!o||o.locked||puzzleSignature(o)!==plan.signatures[i])throw Error('Puzzle geometry or entities changed manually. Detach it before editing/removing generated pieces.');
}}
function referenced(project:Project,ownerIds:Set<string>,lost:Set<string>):string[]{
 const refs=new Set<string>();if(!lost.size)return [];
 for(const o of project.objects){if(!isEntity(o)||ownerIds.has(o.id))continue;
  for(const key of ['target','killtarget','master','trigger_target'])if(lost.has(o.props[key]))refs.add(o.props[key]);
  if(o.classname==='multi_manager')for(const key of Object.keys(o.props))if(lost.has(key.replace(/#\d+$/,'')))refs.add(key);
 }
 for(const e of project.eventSequences||[])for(const c of e.cues)if(lost.has(c.target))refs.add(c.target);
 for(const p of project.encounterPlans||[])if(lost.has(p.completionTarget))refs.add(p.completionTarget);
 for(const p of project.puzzlePlans||[])if(![...ownerIds].includes(p.id)&&lost.has(p.completionTarget))refs.add(p.completionTarget);
 for(const m of project.missionPlans||[])for(const s of m.stages)for(const n of [s.output,s.failureOutput])if(n&&lost.has(n))refs.add(n);
 return [...refs];
}
export function savePuzzle(project:Project,plan:PuzzlePlan):Project{
 const errs=puzzleIssues(plan,project).filter(i=>i.level==='error');if(errs.length)throw Error(errs.map(x=>x.message).join(' | '));
 const old=project.puzzlePlans?.find(p=>p.id===plan.id);if(old)assertIntact(project,old);
 const oldIds=new Set(old?.memberIds||[]);const members=buildPuzzleObjects(plan);
 const names=new Set(members.filter(isEntity).map(o=>o.props.targetname));
 const removed=new Set(project.objects.filter(o=>oldIds.has(o.id)&&isEntity(o)).map(o=>(o as PointEntity).props.targetname).filter(n=>n&&!names.has(n)));
 const refs=referenced(project,oldIds,removed);if(refs.length)throw Error(`Cannot remove referenced target(s): ${refs.join(', ')}. Detach or disconnect first.`);
 const record:PuzzlePlan={...plan,memberIds:members.map(o=>o.id),signatures:members.map(puzzleSignature)};
 return {...project,objects:[...project.objects.filter(o=>!oldIds.has(o.id)),...members],puzzlePlans:[...(project.puzzlePlans||[]).filter(p=>p.id!==plan.id),record]};
}
export function removePuzzle(project:Project,id:string,detach=false):Project{
 const old=project.puzzlePlans?.find(p=>p.id===id);if(!old)throw Error('Puzzle not found.');
 if(detach)return {...project,puzzlePlans:project.puzzlePlans?.filter(p=>p.id!==id)};
 assertIntact(project,old);const own=new Set(old.memberIds),lost=new Set(project.objects.filter(o=>own.has(o.id)&&isEntity(o)).map(o=>(o as PointEntity).props.targetname).filter(Boolean));
 const refs=referenced(project,own,lost);if(refs.length)throw Error(`Other systems still reference ${refs.join(', ')}. Detach or disconnect first.`);
 return {...project,objects:project.objects.filter(o=>!own.has(o.id)),puzzlePlans:project.puzzlePlans?.filter(p=>p.id!==id)};
}
export function validatePuzzleMetadata(input:unknown):void{
 const p=input as Project;if(p.puzzlePlans===undefined)return;
 if(!Array.isArray(p.puzzlePlans)||p.puzzlePlans.length>96)throw Error('Invalid project: puzzle collection.');
 const ids=new Set<string>();
 for(const x of p.puzzlePlans){if(!x||!sid(x.id)||ids.has(x.id)||!text(x.name,100)||typeof x.description!=='string'||x.description.length>500||!['switches','simultaneous'].includes(x.mode)||!validVec(x.origin)||!Array.isArray(x.buttons)||x.buttons.length<2||x.buttons.length>6||!x.buttons.every(validVec)||!Number.isFinite(x.window)||x.window<1||x.window>30||typeof x.completionTarget!=='string'||(x.completionTarget&&!namePattern.test(x.completionTarget))||typeof x.missionStageId!=='string'||x.missionStageId.length>256||typeof x.eventSequenceId!=='string'||x.eventSequenceId.length>256||!Array.isArray(x.memberIds)||x.memberIds.length>32||!x.memberIds.every(id=>typeof id==='string'&&id.length<=256)||!Array.isArray(x.signatures)||x.signatures.length!==x.memberIds.length||!x.signatures.every(s=>typeof s==='string'&&s.length<=8192))throw Error('Invalid project: malformed puzzle metadata.');ids.add(x.id);}
}
