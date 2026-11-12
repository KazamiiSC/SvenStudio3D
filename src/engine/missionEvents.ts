/** Mission & Campaign + Dynamic Events: editable Sven Co-op native entity graphs.
 * No scripts are injected and no automatic claims are made about in-game gameplay state.
 * A mission completion is an externally triggered relay; a sequence is a multi_manager.
 */
import type {MapObject,PointEntity,Project,Vec3} from './types';
import {uid} from './types';
export type UseMode='toggle'|'on'|'off'|'kill';
export type EventCue={id:string;at:number;target:string;mode:UseMode;note:string};
export type EventSequence={id:string;name:string;description:string;cues:EventCue[];origin:Vec3;memberIds:string[];signatures:string[]};
export type MissionStage={
 id:string;title:string;description:string;sequenceId:string;output:string;
 /** Empty follows the visible order, '__end__' finishes, or a stage ID selects a branch. */
 nextStageId?:string;
 /** Alternative route fired by the optional externally wired failure relay. */
 failStageId?:string;
 /** External target to fire when failure is reported (can accompany a stage branch). */
 failureOutput?:string;
 /** One signal normally; 2–16 requires game_counter inputs (not unique players). */
 requiredActivations?:number;
 /** Visual annotation: skipping requires an explicit alternative path. */
 optional?:boolean;
};
export type MissionPlan={id:string;name:string;autoStart:boolean;stages:MissionStage[];origin:Vec3;memberIds:string[];signatures:string[]};
export type Issue={level:'error'|'warning';message:string};
export const EVENT_LIMIT=48, STAGE_LIMIT=24, REQUIRED_ACTIVATIONS_LIMIT=16;
export const eventTargetName=(id:string)=>`sv_evt_${id.replace(/[^a-zA-Z0-9]/g,'').slice(0,24)}`;
export const stageStartName=(id:string)=>`sv_ms_${id.replace(/[^a-zA-Z0-9]/g,'').slice(0,24)}_s`;
export const stageCompleteName=(id:string)=>`sv_ms_${id.replace(/[^a-zA-Z0-9]/g,'').slice(0,24)}_done`;
export const stageFailureName=(id:string)=>`sv_ms_${id.replace(/[^a-zA-Z0-9]/g,'').slice(0,24)}_fail`;
const stageManagerName=(id:string)=>`sv_ms_${id.replace(/[^a-zA-Z0-9]/g,'').slice(0,24)}_m`;
const stageMessageName=(id:string)=>`sv_ms_${id.replace(/[^a-zA-Z0-9]/g,'').slice(0,24)}_hud`;
export const namePattern=/^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const finite=(n:number)=>Number.isFinite(n)&&n>=0&&n<=600;
const safeText=(s:string,max:number)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\"\\]/.test(s);
const position=(base:Vec3,index:number):Vec3=>[base[0]+((index%6)*32),base[1]+Math.floor(index/6)*32,base[2]+32];
const point=(classname:string,targetname:string,props:Record<string,string>,pos:Vec3,group:string):PointEntity=>({id:uid(),kind:'entity',name:classname,classname,position:pos,props:{targetname,...props},group,layer:'Gameplay'});
export function signature(object:MapObject):string{
 if(object.kind==='entity')return JSON.stringify([object.classname,object.position,object.props,object.group,object.layer]);
 return JSON.stringify([object.position,object.vertices,object.faces,object.entityId]);
}
const generatedIds=(p:Project)=>new Set([...(p.missionPlans||[]),...(p.eventSequences||[])].flatMap(r=>r.memberIds));
const externalNames=(p:Project,excludedIds:string[])=>new Set(p.objects.filter(o=>o.kind==='entity'&&!excludedIds.includes(o.id)).map(o=>(o as PointEntity).props.targetname).filter(Boolean));
/** Protect authored links before regenerating/deleting entities with no longer valid names. */
function linkedTargetNames(project:Project,ownerIds:Set<string>,names:Set<string>,ownerEventId?:string,ownerMissionId?:string):string[]{
 if(!names.size)return [];
 const references=new Set<string>();
 for(const object of project.objects){
  if(object.kind!=='entity'||ownerIds.has(object.id))continue;
  const props=object.props;
  // Explicit I/O references; multi_manager stores targets as keys instead of values.
  for(const key of ['target','killtarget','master'])if(names.has(props[key]))references.add(props[key]);
  if(object.classname==='multi_manager')for(const key of Object.keys(props)){
   const target=key.replace(/#\d+$/,'');if(names.has(target))references.add(target);
  }
 }
 for(const event of project.eventSequences||[]){
  if(event.id===ownerEventId)continue;
  for(const cue of event.cues)if(names.has(cue.target))references.add(cue.target);
 }
 for(const puzzle of project.puzzlePlans||[]){
  for(const n of [puzzle.completionTarget,puzzle.eventSequenceId?eventTargetName(puzzle.eventSequenceId):'',puzzle.missionStageId?stageCompleteName(puzzle.missionStageId):''])if(n&&names.has(n))references.add(n);
 }
 for(const mission of project.missionPlans||[])for(const stage of mission.id===ownerMissionId?[]:mission.stages){
  if(stage.output&&names.has(stage.output))references.add(stage.output);
  if(stage.failureOutput&&names.has(stage.failureOutput))references.add(stage.failureOutput);
 }
 return [...references];
}

export function cueIssues(cues:EventCue[],project:Project,existingId?:string):Issue[]{
 const issues:Issue[]=[];
 if(cues.length>EVENT_LIMIT)issues.push({level:'error',message:`Maximum ${EVENT_LIMIT} events per sequence.`});
 const known=new Set(project.objects.filter(o=>o.kind==='entity').map(o=>(o as PointEntity).props.targetname).filter(Boolean));
 for(const event of project.eventSequences||[])known.add(eventTargetName(event.id));
 for(const mission of project.missionPlans||[])for(const stage of mission.stages){known.add(stageStartName(stage.id));known.add(stageCompleteName(stage.id));if(stage.failStageId||stage.failureOutput)known.add(stageFailureName(stage.id));}
 for(const [i,cue] of cues.entries()){
  if(!finite(cue.at))issues.push({level:'error',message:`Event ${i+1}: time must be 0–600 seconds.`});
  if(!namePattern.test(cue.target as string))issues.push({level:'error',message:`Event ${i+1}: targetname must be a valid native target.`});
  else if(!known.has(cue.target))issues.push({level:'warning',message:`Event ${i+1}: '${cue.target}' is not present in the current map.`});
  if(!['toggle','on','off','kill'].includes(cue.mode))issues.push({level:'error',message:`Event ${i+1}: invalid trigger mode.`});
  if(cue.note.length>200)issues.push({level:'error',message:`Event ${i+1}: note too long.`});
  if(existingId&&cue.target===eventTargetName(existingId))issues.push({level:'error',message:`Event ${i+1}: sequence triggers itself.`});
 }
 if(existingId){
  const records=new Map((project.eventSequences||[]).map(seq=>[seq.id,seq.cues]));
  records.set(existingId,cues);
  const owners=new Map([...records.keys()].map(id=>[eventTargetName(id),id]));
  const active=new Set<string>(),done=new Set<string>();
  const detectsCycle=(id:string):boolean=>{
   if(active.has(id))return true;if(done.has(id))return false;
   active.add(id);
   for(const cue of records.get(id)||[]){const next=owners.get(cue.target);if(next&&detectsCycle(next))return true;}
   active.delete(id);done.add(id);return false;
  };
  if(detectsCycle(existingId)&&!issues.some(i=>i.message.includes('triggers itself')))
   issues.push({level:'error',message:'Event sequences form a triggering cycle. Unlink the recursive target before saving.'});
 }
 return issues;
}
/** Resolve a stage's successor without relying on ordinal IDs; used by export and inspection. */
export function successStageId(plan:MissionPlan,index:number):string{
 const stage=plan.stages[index];
 if(!stage)return '';
 return stage.nextStageId==='__end__'?'':stage.nextStageId||plan.stages[index+1]?.id||'';
}
export function missionGraph(plan:MissionPlan):{reachable:Set<string>;cycles:string[][]}{
 const byId=new Map(plan.stages.map(s=>[s.id,s]));
 const neighbors=(id:string)=>{
  const i=plan.stages.findIndex(s=>s.id===id);if(i<0)return [];
  return [successStageId(plan,i),byId.get(id)?.failStageId||''].filter(x=>byId.has(x));
 };
 const reachable=new Set<string>(),visited=new Set<string>(),active:string[]=[],cycles:string[][]=[];
 const walk=(id:string)=>{
  if(active.includes(id)){cycles.push([...active.slice(active.indexOf(id)),id]);return;}
  if(visited.has(id))return;
  visited.add(id);reachable.add(id);active.push(id);
  for(const next of neighbors(id))walk(next);
  active.pop();
 };
 if(plan.stages[0])walk(plan.stages[0].id);
 return {reachable,cycles};
}
export function missionIssues(plan:MissionPlan,p:Project):Issue[]{
 const issues:Issue[]=[];
 if(!safeText(plan.name,100))issues.push({level:'error',message:'Mission name is missing or invalid.'});
 if(!plan.stages.length||plan.stages.length>STAGE_LIMIT)issues.push({level:'error',message:`Mission needs 1–${STAGE_LIMIT} stages.`});
 const ids=new Set<string>();const nativeNames=new Set<string>();
 for(const [i,stage] of plan.stages.entries()){
  if(!stage.id||stage.id.length>256||ids.has(stage.id))issues.push({level:'error',message:`Stage ${i+1}: duplicate or invalid identifier.`}); ids.add(stage.id);
  for(const name of [stageStartName(stage.id),stageCompleteName(stage.id),stageFailureName(stage.id),stageManagerName(stage.id),stageMessageName(stage.id)]){
   if(nativeNames.has(name))issues.push({level:'error',message:`Stage ${i+1}: generated targetname collision.`});nativeNames.add(name);
  }
  if(!safeText(stage.title,100)||typeof stage.description!=='string'||stage.description.length>450||/["\\\x00-\x1f]/.test(stage.description))issues.push({level:'error',message:`Stage ${i+1}: invalid title or description.`});
  if(stage.sequenceId&&!(p.eventSequences||[]).some(s=>s.id===stage.sequenceId))issues.push({level:'error',message:`Stage ${i+1}: linked event sequence not found.`});
  if(stage.output&&!namePattern.test(stage.output))issues.push({level:'error',message:`Stage ${i+1}: invalid final output target.`});
  if(stage.failureOutput&&!namePattern.test(stage.failureOutput))issues.push({level:'error',message:`Stage ${i+1}: invalid failure output target.`});
  if(stage.nextStageId&&!['__end__',...plan.stages.map(s=>s.id)].includes(stage.nextStageId))issues.push({level:'error',message:`Stage ${i+1}: success branch references a missing stage.`});
  if(stage.failStageId&&!plan.stages.some(s=>s.id===stage.failStageId))issues.push({level:'error',message:`Stage ${i+1}: failure branch references a missing stage.`});
  if(stage.requiredActivations!==undefined&&(!Number.isInteger(stage.requiredActivations)||stage.requiredActivations<1||stage.requiredActivations>REQUIRED_ACTIVATIONS_LIMIT))issues.push({level:'error',message:`Stage ${i+1}: required activations must be 1–${REQUIRED_ACTIVATIONS_LIMIT}.`});
  if(stage.optional!==undefined&&typeof stage.optional!=='boolean')issues.push({level:'error',message:`Stage ${i+1}: invalid optional flag.`});
  if(stage.nextStageId===stage.id||stage.failStageId===stage.id)issues.push({level:'error',message:`Stage ${i+1}: a branch cannot target itself.`});
  if(stage.output&&successStageId(plan,i))issues.push({level:'warning',message:`Stage ${i+1}: external final output is unused because a success stage is selected.`});
 }
 if(plan.stages.length){
  const {reachable,cycles}=missionGraph(plan);
  for(const cycle of cycles)issues.push({level:'error',message:`Mission branches contain a cycle (${cycle.length-1} steps).`});
  for(const [i,stage] of plan.stages.entries())if(!reachable.has(stage.id))issues.push({level:'warning',message:`Stage ${i+1} is unreachable from the first objective.`});
 }
 const names=new Set(p.objects.filter(o=>o.kind==='entity').map(o=>(o as PointEntity).props.targetname).filter(Boolean));
 for(const [i,stage] of plan.stages.entries())for(const target of [stage.output,stage.failureOutput]){
  if(target&&!names.has(target)&&!nativeNames.has(target))issues.push({level:'warning',message:`Stage ${i+1}: external target '${target}' was not found in this map.`});
 }
 return issues;
}
const fmtTime=(n:number)=>Number(n.toFixed(3)).toString();
export function createEventEntities(sequence:EventSequence):PointEntity[]{
 const props:Record<string,string>={};
 const used=new Map<string,number>();
 for(const cue of [...sequence.cues].sort((a,b)=>a.at-b.at)){
  const nth=used.get(cue.target)||0;used.set(cue.target,nth+1);
  const key=nth?`${cue.target}#${nth}`:cue.target;
  // GoldSrc duplicate keys: a suffixed #number is used only for duplicates;
  // timing is encoded in the value, with a use-mode suffix when necessary.
  const mode=cue.mode==='toggle'?'':cue.mode==='off'?'#0':cue.mode==='on'?'#1':'#2';
  props[key]=`${fmtTime(cue.at)}${mode}`;
 }
 return [point('multi_manager',eventTargetName(sequence.id),props,sequence.origin,`Dynamic Events: ${sequence.name}`)];
}
export function createMissionEntities(plan:MissionPlan):PointEntity[]{
 const objects:PointEntity[]=[];
 let i=0;
 for(let j=0;j<plan.stages.length;j++){
  const stage=plan.stages[j];
  const nextId=successStageId(plan,j);
  const target=nextId?stageStartName(nextId):stage.output;
  const group=`Mission: ${plan.name}`;
  objects.push(point('trigger_relay',stageStartName(stage.id),{target:stageManagerName(stage.id),triggerstate:'2'},position(plan.origin,i++),group));
  objects.push(point('game_text',stageMessageName(stage.id),{message:`${j+1}. ${stage.title}`.slice(0,100),spawnflags:'3',x:'-1',y:'0.24',color:'110 220 255',fadein:'0.2',holdtime:'4',fadeout:'1',channel:'4'},position(plan.origin,i++),group));
  const managerProps:Record<string,string>={[stageMessageName(stage.id)]:'0'};
  if(stage.sequenceId)managerProps[eventTargetName(stage.sequenceId)]='0.15';
  objects.push(point('multi_manager',stageManagerName(stage.id),managerProps,position(plan.origin,i++),group));
  const count=stage.requiredActivations??1;
  if(count>1){
   // game_counter counts USE activations, not unique players. Remove on fire to avoid accidental repeat.
   objects.push(point('game_counter',stageCompleteName(stage.id),{...(target?{target}:{}),frags:'0',health:String(count),spawnflags:'1'},position(plan.origin,i++),group));
  }else{
   objects.push(point('trigger_relay',stageCompleteName(stage.id),{...(target?{target}:{}),triggerstate:'2'},position(plan.origin,i++),group));
  }
  if(stage.failStageId||stage.failureOutput){
   const branch=stage.failStageId?stageStartName(stage.failStageId):'';
   if(branch&&stage.failureOutput&&branch!==stage.failureOutput){
    objects.push(point('multi_manager',stageFailureName(stage.id),{[branch]:'0',[stage.failureOutput]:'0'},position(plan.origin,i++),group));
   }else{
    objects.push(point('trigger_relay',stageFailureName(stage.id),{target:branch||stage.failureOutput||'',triggerstate:'2'},position(plan.origin,i++),group));
   }
  }
 }
 if(plan.autoStart&&plan.stages.length){
  objects.push(point('trigger_auto','', {target:stageStartName(plan.stages[0].id),delay:'0.5',spawnflags:'1',triggerstate:'2'},position(plan.origin,i++),`Mission: ${plan.name}`));
 }
 return objects;
}

/** Editor-only deterministic logic inspection; never executes engine entities or map scripts. */
export type MissionSimulation={activeId:string;counts:Record<string,number>;history:{stageId:string;signal:'start'|'complete'|'fail'|'count';target:string}[];finished:boolean};
export function newMissionSimulation(plan:MissionPlan):MissionSimulation{
 const id=plan.stages[0]?.id||'';
 const history:MissionSimulation['history']=id?[{stageId:id,signal:'start',target:stageStartName(id)}]:[];
 if(id&&plan.stages[0].sequenceId)history.push({stageId:id,signal:'start',target:eventTargetName(plan.stages[0].sequenceId)});
 return {activeId:id,counts:{},history,finished:!id};
}
export function stepMissionSimulation(plan:MissionPlan,current:MissionSimulation,signal:'complete'|'fail'):MissionSimulation{
 if(current.finished||!current.activeId)return current;
 const index=plan.stages.findIndex(s=>s.id===current.activeId);if(index<0)return {...current,finished:true,activeId:''};
 const stage=plan.stages[index],counts={...current.counts},history=[...current.history];
 if(signal==='complete'){
  counts[stage.id]=(counts[stage.id]||0)+1;
  if(counts[stage.id]<(stage.requiredActivations||1)){
   history.push({stageId:stage.id,signal:'count',target:stageCompleteName(stage.id)});
   return {...current,counts,history};
  }
 }
 const next=signal==='complete'?successStageId(plan,index):stage.failStageId||'';
 const external=signal==='complete'?stage.output:stage.failureOutput||'';
 history.push({stageId:stage.id,signal,target:signal==='complete'?stageCompleteName(stage.id):stageFailureName(stage.id)});
 if(signal==='fail'&&external)history.push({stageId:stage.id,signal,target:external});
 if(next){
  history.push({stageId:next,signal:'start',target:stageStartName(next)});
  const nextStage=plan.stages.find(s=>s.id===next);
  if(nextStage?.sequenceId)history.push({stageId:next,signal:'start',target:eventTargetName(nextStage.sequenceId)});
  return {activeId:next,counts,history,finished:false};
 }
 if(signal==='complete'&&external)history.push({stageId:stage.id,signal,target:external});
 return {activeId:'',counts,history,finished:true};
}
export function inspectEventTimeline(sequence:EventSequence,time:number,project:Project):{cue:EventCue;exists:boolean}[]{
 const targets=new Set(project.objects.filter(o=>o.kind==='entity').map(o=>(o as PointEntity).props.targetname).filter(Boolean));
 return [...sequence.cues].filter(c=>c.at<=time).sort((a,b)=>a.at-b.at).map(cue=>({cue,exists:targets.has(cue.target)}));
}

/** No silent overwrites: generated entities are protected by an exact signature. */
export function applyRecord<T extends EventSequence|MissionPlan>(project:Project,record:T,kind:'event'|'mission'):{project:Project;record:T}{
 const key=kind==='event'?'eventSequences':'missionPlans';
 const list=(kind==='event'?project.eventSequences||[]:project.missionPlans||[]) as T[];
 const previous=list.find(item=>item.id===record.id);
 if(kind==='mission'&&previous){
  const surviving=new Set((record as MissionPlan).stages.map(stage=>stage.id));
  const linked=(project.encounterPlans||[]).filter(enc=>enc.missionStageId&&
   (previous as MissionPlan).stages.some(stage=>stage.id===enc.missionStageId)&&!surviving.has(enc.missionStageId));
  if(linked.length)throw Error('Mission objective is linked to an NPC encounter. Unlink the encounter before removing the objective.');
  if((project.puzzlePlans||[]).some(puzzle=>puzzle.missionStageId&&(previous as MissionPlan).stages.some(stage=>stage.id===puzzle.missionStageId)&&!surviving.has(puzzle.missionStageId)))throw Error('Mission objective is linked to a puzzle. Unlink the puzzle first.');
 }
 const removed=new Set(previous?.memberIds||[]);
 if(previous){
  if(previous.memberIds.length!==previous.signatures.length)throw Error('Generated provenance is incomplete. Use Detach to keep manually edited entities.');
  for(let i=0;i<previous.memberIds.length;i++){
   const obj=project.objects.find(o=>o.id===previous.memberIds[i]);
   if(!obj||signature(obj)!==previous.signatures[i])throw Error('A generated entity was modified or removed manually. The original was preserved. Detach or restore it before updating.');
  }
 }
 const generated=kind==='event'?createEventEntities(record as EventSequence):createMissionEntities(record as MissionPlan);
 if(previous){
  const nextNames=new Set(generated.map(o=>o.props.targetname).filter(Boolean));
  const lost=new Set(project.objects.filter(o=>removed.has(o.id)&&o.kind==='entity').map(o=>(o as PointEntity).props.targetname).filter(name=>name&&!nextNames.has(name)));
  const refs=linkedTargetNames(project,removed,lost,kind==='event'?record.id:undefined,kind==='mission'?record.id:undefined);
  if(refs.length)throw Error(`Generated targets still referenced elsewhere (${refs.join(', ')}). Unlink those references before updating.`);
 }
 const allNames=externalNames(project,[...removed]);
 for(const entity of generated){const name=entity.props.targetname;if(name&&allNames.has(name))throw Error(`Targetname '${name}' is already in use. No changes were made.`);}
 if(project.objects.length-removed.size+generated.length>100000)throw Error('Map object limit reached.');
 const updated={...record,memberIds:generated.map(e=>e.id),signatures:generated.map(signature)};
 const nextList=[...list.filter(x=>x.id!==record.id),updated];
 return {project:{...project,objects:[...project.objects.filter(o=>!removed.has(o.id)),...generated], [key]:nextList},record:updated as T};
}
export function removeRecord(project:Project,id:string,kind:'event'|'mission',detach=false):Project{
 if(kind==='event'&&(project.missionPlans||[]).some(m=>m.stages.some(s=>s.sequenceId===id)))throw Error('This sequence is referenced by a mission stage. Unlink it first.');
 if(kind==='event'&&(project.encounterPlans||[]).some(enc=>enc.waves.some(w=>w.eventSequenceId===id)))throw Error('This sequence is referenced by an NPC encounter. Unlink it first.');
 if(kind==='event'&&(project.puzzlePlans||[]).some(p=>p.eventSequenceId===id))throw Error('This sequence is referenced by a puzzle. Unlink it first.');
 if(kind==='mission'){
  const old=(project.missionPlans||[]).find(m=>m.id===id);
  if(old&&(project.encounterPlans||[]).some(enc=>old.stages.some(stage=>stage.id===enc.missionStageId)))
   throw Error('A mission objective is linked to an NPC encounter. Unlink the encounter first.');
  if(old&&(project.puzzlePlans||[]).some(p=>old.stages.some(stage=>stage.id===p.missionStageId)))throw Error('A mission objective is linked to a puzzle. Unlink the puzzle first.');
 }
 const list=kind==='event'?project.eventSequences||[]:project.missionPlans||[];
 const prev=list.find(s=>s.id===id);if(!prev)throw Error('Record not found.');
 if(!detach){for(let i=0;i<prev.memberIds.length;i++){
  const obj=project.objects.find(o=>o.id===prev.memberIds[i]);
  if(!obj||signature(obj)!==prev.signatures[i])throw Error('Generated entity changed. Detach instead to preserve it.');
 }}
 const removed=new Set(detach?[]:prev.memberIds);
 if(!detach){
  const ownedNames=new Set(project.objects.filter(o=>removed.has(o.id)&&o.kind==='entity').map(o=>(o as PointEntity).props.targetname).filter(Boolean));
  const other=linkedTargetNames(project,removed,ownedNames,kind==='event'?id:undefined,kind==='mission'?id:undefined);
  if(other.length)throw Error(`Generated targets are still referenced (${other.join(', ')}). Unlink those references or detach to keep the native entities.`);
 }
 return {...project,objects:project.objects.filter(o=>!removed.has(o.id)),...(kind==='event'?{eventSequences:(project.eventSequences||[]).filter(s=>s.id!==id)}:{missionPlans:(project.missionPlans||[]).filter(m=>m.id!==id)})};
}
export function createMissionPreset(kind:'infiltration'|'survival'|'escape'|'blank'):MissionPlan{
 const labels={infiltration:['Enter the facility','Restore the power','Unlock the laboratory','Reach extraction'],survival:['Secure the area','Hold the position','Eliminate reinforcements','Reach the safe room'],escape:['Find the exit','Disable security','Open the access door','Evacuate'],blank:['New objective']}[kind];
 return {id:uid(),name:kind==='blank'?'New mission':kind==='infiltration'?'Facility infiltration':kind==='survival'?'Cooperative survival':'Escape operation',autoStart:true,origin:[0,0,96],stages:labels.map(title=>({id:uid(),title,description:'Connect a button, trigger or existing entity to the completion relay.',sequenceId:'',output:''})),memberIds:[],signatures:[]};
}
/** Duplicate presets safely: new native targetnames and remapped internal branches. */
export function duplicateMissionPlan(plan:MissionPlan):MissionPlan{
 const ids=new Map(plan.stages.map(s=>[s.id,uid()]));
 return {
  ...plan,origin:[...plan.origin] as Vec3,id:uid(),name:`${plan.name} (copy)`.slice(0,100),
  stages:plan.stages.map(stage=>({
   ...stage,id:ids.get(stage.id)!,
   nextStageId:stage.nextStageId&&stage.nextStageId!=='__end__'?ids.get(stage.nextStageId)||'':stage.nextStageId,
   failStageId:stage.failStageId?ids.get(stage.failStageId)||'':'',
  })),memberIds:[],signatures:[]
 };
}
export function duplicateEventSequence(sequence:EventSequence):EventSequence{
 return {...sequence,origin:[...sequence.origin] as Vec3,id:uid(),name:`${sequence.name} (copy)`.slice(0,100),cues:sequence.cues.map(c=>({...c,id:uid()})),memberIds:[],signatures:[]};
}

export function createEventPreset(kind:'alarm'|'reinforcements'|'reactor'|'blank'):EventSequence{
 const name={alarm:'Security alarm sequence',reinforcements:'Enemy reinforcement sequence',reactor:'Reactor emergency',blank:'New event sequence'}[kind];
 const descriptions={alarm:'Trigger warning lights, alarms, then seal a door.',reinforcements:'Stage waves of NPC spawner activations.',reactor:'Coordinate warning lights, sounds and explosion entities.',blank:'Trigger existing map entities on a timeline.'};
 const targets=kind==='alarm'?['alarm_sound','security_lights','security_door']:kind==='reinforcements'?['wave_1','wave_2','wave_3']:kind==='reactor'?['reactor_alarm','reactor_lights','reactor_explosion']:[];
 return {id:uid(),name,description:descriptions[kind],origin:[0,0,96],cues:targets.map((target,i)=>({id:uid(),at:i*3,target,mode:'on' as UseMode,note:''})),memberIds:[],signatures:[]};
}
export function generatedTargetIndex(p:Project):Set<string>{
 const names=new Set<string>();
 for(const seq of p.eventSequences||[])names.add(eventTargetName(seq.id));
 for(const mission of p.missionPlans||[])for(const stage of mission.stages){names.add(stageStartName(stage.id));names.add(stageCompleteName(stage.id));if(stage.failStageId||stage.failureOutput)names.add(stageFailureName(stage.id));}
 return names;
}
export function stableObjectIdCount(p:Project){return generatedIds(p).size;}

/** Validate persisted metadata before it enters the editor; never silently repair it. */
export function validateMissionEventMetadata(input:unknown):void{
 const project=input as Project;
 const isObj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const str=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
 const vector=(v:unknown)=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=131072);
 const seenIds=new Set<string>();
 const checkBase=(record:unknown,limit:number)=>{
  if(!isObj(record)||!str(record.id,256)||!record.id||!str(record.name,100)||!vector(record.origin)||
    !Array.isArray(record.memberIds)||record.memberIds.length>limit||!record.memberIds.every(x=>str(x,256))||
    !Array.isArray(record.signatures)||record.signatures.length!==record.memberIds.length||
    !record.signatures.every(x=>str(x,8192)))throw Error('Invalid project: malformed mission/event metadata.');
  if(seenIds.has(record.id as string))throw Error('Invalid project: duplicated mission/event ID.');seenIds.add(record.id as string);
  return record;
 };
 if(project.eventSequences!==undefined){
  if(!Array.isArray(project.eventSequences)||project.eventSequences.length>128)throw Error('Invalid project: too many event sequences.');
  for(const item of project.eventSequences){
   const seq=checkBase(item,1);
   if(!str(seq.description,1000)||!Array.isArray(seq.cues)||seq.cues.length>EVENT_LIMIT)throw Error('Invalid project: malformed timeline.');
   for(const cue of seq.cues){
    if(!isObj(cue)||!str(cue.id,256)||!str(cue.target,64)||!namePattern.test(cue.target as string)||
      !str(cue.note,200)||typeof cue.at!=='number'||!finite(cue.at)||!['toggle','on','off','kill'].includes(String(cue.mode)))
      throw Error('Invalid project: malformed timed event.');
   }
  }
 }
 if(project.missionPlans!==undefined){
  if(!Array.isArray(project.missionPlans)||project.missionPlans.length>128)throw Error('Invalid project: too many mission plans.');
  for(const item of project.missionPlans){
   const plan=checkBase(item,STAGE_LIMIT*5+1);
   if(typeof plan.autoStart!=='boolean'||!Array.isArray(plan.stages)||plan.stages.length<1||plan.stages.length>STAGE_LIMIT)throw Error('Invalid project: malformed mission stages.');
   const ids=new Set();
   for(const stage of plan.stages){
    if(!isObj(stage)||!str(stage.id,256)||!stage.id||ids.has(stage.id)||!str(stage.title,100)||!str(stage.description,450)||
       !str(stage.sequenceId,256)||!str(stage.output,64)||
       (stage.output!==''&&!namePattern.test(stage.output as string))||
       (stage.nextStageId!==undefined&&!str(stage.nextStageId,256))||
       (stage.failStageId!==undefined&&!str(stage.failStageId,256))||
       (stage.failureOutput!==undefined&&(!str(stage.failureOutput,64)||(stage.failureOutput!==''&&!namePattern.test(stage.failureOutput as string))))||
       (stage.optional!==undefined&&typeof stage.optional!=='boolean')||
       (stage.requiredActivations!==undefined&&(!Number.isInteger(stage.requiredActivations)||Number(stage.requiredActivations)<1||Number(stage.requiredActivations)>REQUIRED_ACTIVATIONS_LIMIT)))throw Error('Invalid project: malformed mission objective.');
    ids.add(stage.id);
   }
   for(const stage of plan.stages){
    if(stage.nextStageId&&stage.nextStageId!=='__end__'&&!plan.stages.some(s=>s.id===stage.nextStageId))throw Error('Invalid project: missing success branch.');
    if(stage.failStageId&&!plan.stages.some(s=>s.id===stage.failStageId))throw Error('Invalid project: missing failure branch.');
   }
  }
 }
}
