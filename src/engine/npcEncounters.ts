/** Smart NPC Encounters 2.0: authored, reversible native Sven Co-op entity chains.
 * A wave ends when every spawned monster fires its Death trigger_target into
 * a single-use game_counter. This is NOT a simulation of the engine's AI.
 * Supported base: squadmaker / game_counter / multi_manager / trigger_once.
 */
import type {Brush,MapObject,PointEntity,Project,Vec3} from './types';
import {uid} from './types';
import {createBrush} from './geometry';
import {eventTargetName,stageCompleteName,signature,namePattern} from './missionEvents';

export type EncounterStart='manual'|'trigger'|'auto';
export type EncounterWave={
 id:string;name:string;monster:string;count:number;maxLive:number;delay:number;
 /** Exact GoldSrc world coordinates of separate spawn positions. */
 spawns:Vec3[];
 ally:boolean;health:number;weapons:number;pathName:string;guardTarget:string;
 eventSequenceId:string;
};
export type EncounterPlan={
 id:string;name:string;description:string;origin:Vec3;start:EncounterStart;
 waves:EncounterWave[];completionTarget:string;
 /** Optional link to Mission & Campaign Studio's externally triggered completion relay. */
 missionStageId:string;
 memberIds:string[];signatures:string[];
};
export type EncounterIssue={level:'error'|'warning';message:string;waveId?:string};
export const MAX_WAVES=8, MAX_WAVE_MONSTERS=24, MAX_SPAWNS=4, MAX_ENTITIES_PER_PLAN=160;
export const encounterPrefix=(id:string)=>`sv_en_${id.replace(/[^a-zA-Z0-9]/g,'').slice(0,19)}`;
export const encounterStartName=(id:string)=>`${encounterPrefix(id)}_start`;
export const encounterFinishName=(id:string)=>`${encounterPrefix(id)}_finish`;
export const waveName=(waveId:string,suffix:string)=>`sv_ew_${waveId.replace(/[^a-zA-Z0-9]/g,'').slice(0,19)}_${suffix}`;
const isPoint=(o:MapObject):o is PointEntity=>o.kind==='entity';
const vector=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=131072);
const text=(s:unknown,max=100)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/["\\\r\n\x00-\x1f]/.test(s);
const validExternal=(s:string)=>!s||namePattern.test(s);
const safeId=(id:string)=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(id);
const plus=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const point=(cls:string,name:string,pos:Vec3,props:Record<string,string>,group:string):PointEntity=>({id:uid(),kind:'entity',name:cls,classname:cls,position:[...pos],props:{targetname:name,...props},group,layer:'NPC Encounters'});
const entityNames=(project:Project,except:Set<string>)=>new Set(project.objects.filter(o=>isPoint(o)&&!except.has(o.id)).map(o=>(o as PointEntity).props.targetname).filter(Boolean));
export function createEncounterWave(origin:Vec3=[0,0,0],type='monster_human_grunt'):EncounterWave{
 return {id:uid(),name:'Reinforcements',monster:type,count:4,maxLive:3,delay:0.8,spawns:[plus(origin,[128,128,48]),plus(origin,[128,-128,48])],ally:false,health:0,weapons:0,pathName:'',guardTarget:'',eventSequenceId:''};
}
export function createEncounterPreset(kind:'defense'|'ambush'|'mixed'='defense',origin:Vec3=[0,0,0]):EncounterPlan{
 const waves=kind==='ambush'?[createEncounterWave(origin,'monster_zombie'),createEncounterWave(origin,'monster_human_grunt')]:kind==='mixed'?[createEncounterWave(origin,'monster_human_grunt'),createEncounterWave(origin,'monster_alien_grunt'),createEncounterWave(origin,'monster_zombie')]:[createEncounterWave(origin,'monster_human_grunt'),createEncounterWave(origin,'monster_human_grunt')];
 waves.forEach((wave,i)=>{wave.name=['First contact','Reinforcements','Final assault'][i]||`Wave ${i+1}`;wave.spawns=wave.spawns.map(p=>[p[0]+i*64,p[1],p[2]] as Vec3)});
 return {id:uid(),name:kind==='ambush'?'Security breach':kind==='mixed'?'Black Mesa escalation':'Hold the sector',description:'Native death-counted waves. Connect its start target or place the entry trigger.',origin:[...origin],start:'trigger',waves,completionTarget:'',missionStageId:'',memberIds:[],signatures:[]};
}
export function duplicateEncounter(plan:EncounterPlan):EncounterPlan{
 return {...plan,id:uid(),name:`${plan.name} (copy)`.slice(0,100),origin:[...plan.origin],
  waves:plan.waves.map(w=>({...w,id:uid(),spawns:w.spawns.map(p=>[p[0]+256,p[1],p[2]] as Vec3)})),memberIds:[],signatures:[]};
}
export function encounterIssues(plan:EncounterPlan,project:Project):EncounterIssue[]{
 const issues:EncounterIssue[]=[];
 if(!safeId(plan.id)||!text(plan.name)||typeof plan.description!=='string'||plan.description.length>500)issues.push({level:'error',message:'Invalid encounter name, description or ID.'});
 if(!vector(plan.origin))issues.push({level:'error',message:'Encounter origin must be valid XYZ coordinates.'});
 if(!['manual','trigger','auto'].includes(plan.start))issues.push({level:'error',message:'Invalid start mode.'});
 if(!plan.waves.length||plan.waves.length>MAX_WAVES)issues.push({level:'error',message:`Encounter needs 1–${MAX_WAVES} waves.`});
 if(!validExternal(plan.completionTarget||''))issues.push({level:'error',message:'Invalid completion targetname.'});
 if(plan.missionStageId&&!project.missionPlans?.some(m=>m.stages.some(s=>s.id===plan.missionStageId)))issues.push({level:'error',message:'Linked mission objective no longer exists.'});
 const events=new Set((project.eventSequences||[]).map(e=>e.id));
 const waveIds=new Set<string>(),nativeNames=new Set<string>([encounterStartName(plan.id),encounterFinishName(plan.id),`${encounterPrefix(plan.id)}_completed`,...(plan.start==='trigger'?[`${encounterPrefix(plan.id)}_entry`]:[]),...(plan.start==='auto'?[`${encounterPrefix(plan.id)}_auto`]:[])]);
 for(const [i,wave] of plan.waves.entries()){
  const error=(message:string)=>issues.push({level:'error',message:`Wave ${i+1}: ${message}`,waveId:wave.id});
  if(!safeId(wave.id)||waveIds.has(wave.id))error('duplicate or invalid wave identifier.');waveIds.add(wave.id);
  if(!text(wave.name,92))error('name is invalid.');
  if(!/^monster_[a-z0-9_]{1,70}$/i.test(wave.monster))error('choose a valid monster_* classname.');
  if(!Number.isInteger(wave.count)||wave.count<1||wave.count>MAX_WAVE_MONSTERS)error(`NPC count must be 1–${MAX_WAVE_MONSTERS}.`);
  if(!Number.isInteger(wave.maxLive)||wave.maxLive<1||wave.maxLive>MAX_WAVE_MONSTERS)error('Max alive must be 1–24.');
  if(!Number.isFinite(wave.delay)||wave.delay<0.2||wave.delay>60)error('Spawn interval must be 0.2–60 s.');
  if(!Array.isArray(wave.spawns)||!wave.spawns.length||wave.spawns.length>MAX_SPAWNS||!wave.spawns.every(vector))error('1–4 valid XYZ spawn points are required.');
  if(typeof wave.ally!=='boolean'||!Number.isInteger(wave.health)||wave.health<0||wave.health>2000||!Number.isInteger(wave.weapons)||wave.weapons<0||wave.weapons>512)error('Invalid NPC attributes.');
  if(!validExternal(wave.pathName||'')||!validExternal(wave.guardTarget||''))error('Invalid waypoint or guard targetname.');
  if(wave.eventSequenceId&&!events.has(wave.eventSequenceId))error('Linked Dynamic Events sequence no longer exists.');
  for(const name of [waveName(wave.id,'begin'),waveName(wave.id,'dead'),waveName(wave.id,'text'),...Array.from({length:Math.min(MAX_SPAWNS,wave.spawns.length)},(_,j)=>waveName(wave.id,`spawn${j+1}`))]){
   if(nativeNames.has(name))error('generated targetname collision.');nativeNames.add(name);
  }
  if(wave.maxLive>wave.count)issues.push({level:'warning',waveId:wave.id,message:`Wave ${i+1}: max live exceeds the total NPC count.`});
 }
 if(plan.waves.reduce((s,w)=>s+w.count,0)>80)issues.push({level:'warning',message:'More than 80 NPCs across waves can strain the engine or take a long time to clear.'});
 const own=new Set((project.encounterPlans||[]).find(p=>p.id===plan.id)?.memberIds||[]);
 const external=entityNames(project,own);
 for(const name of nativeNames)if(external.has(name))issues.push({level:'error',message:`The generated targetname '${name}' already belongs to another entity.`});
 if(plan.completionTarget&&nativeNames.has(plan.completionTarget))issues.push({level:'error',message:'Completion target cannot refer back into the same encounter.'});
 if(plan.completionTarget&&!external.has(plan.completionTarget)&&!plan.missionStageId)issues.push({level:'warning',message:`Completion target '${plan.completionTarget}' is not currently in the map.`});
 for(const wave of plan.waves){
  if(wave.pathName&&!external.has(wave.pathName))issues.push({level:'warning',waveId:wave.id,message:`Waypoint '${wave.pathName}' not found.`});
  if(wave.guardTarget&&!external.has(wave.guardTarget))issues.push({level:'warning',waveId:wave.id,message:`Guard target '${wave.guardTarget}' not found.`});
 }
 return issues;
}
/** Create one native game_counter per wave; squadmaker child Death events
 * increment it exactly once per killed spawned NPC. No custom scripts. */
export function buildEncounterObjects(plan:EncounterPlan):MapObject[]{
 const group=`NPC Encounter: ${plan.name}`, result:MapObject[]=[];
 const base=plan.origin;
 const p=(cls:string,name:string,at:Vec3,props:Record<string,string>)=>{const item=point(cls,name,at,props,group);result.push(item);return item};
 if(plan.start==='auto')p('trigger_auto',`${encounterPrefix(plan.id)}_auto`,plus(base,[-80,-64,80]),{target:encounterStartName(plan.id),delay:'0.5',spawnflags:'1'});
 if(plan.start==='trigger'){
  const ent=p('trigger_once',`${encounterPrefix(plan.id)}_entry`,plus(base,[-256,0,72]),{target:encounterStartName(plan.id),spawnflags:'0'});
  const brush=createBrush('box',[...ent.position],[160,160,144],`Encounter entry trigger`);
  brush.entityId=ent.id;brush.layer='NPC Encounters';brush.group=group;
  brush.faces=brush.faces.map(face=>({...face,texture:'AAATRIGGER'}));result.push(brush);
 }
 for(const [i,w] of plan.waves.entries()){
  const at=plus(base,[i*48,0,112]);
  const begin=i===0?encounterStartName(plan.id):waveName(w.id,'begin');
  const dead=waveName(w.id,'dead');
  const next=plan.waves[i+1]?waveName(plan.waves[i+1].id,'begin'):encounterFinishName(plan.id);
  p('game_counter',dead,plus(at,[0,32,0]),{frags:'0',health:String(w.count),target:next||'',spawnflags:'1'});
  const words=w.name.replace(/["\\\r\n]/g,' ').slice(0,92);
  p('game_text',waveName(w.id,'text'),plus(at,[0,64,0]),{message:`${i+1}/${plan.waves.length}: ${words}`,x:'-1',y:'0.18',effect:'0',color:'120 205 240',color2:'120 205 240',fadein:'0.3',fadeout:'1',holdtime:'3',fxtime:'0',channel:'4'});
  const managerProps:Record<string,string>={[waveName(w.id,'text')]:'0'};
  const active=w.spawns.slice(0,Math.min(w.count,w.maxLive,w.spawns.length));
  const baseCount=Math.floor(w.count/active.length),remainder=w.count%active.length;
  active.forEach((spawn,j)=>{
   const n=baseCount+(j<remainder?1:0);
   const spawnName=waveName(w.id,`spawn${j+1}`);
   managerProps[spawnName]=String(j*.15);
   const props:Record<string,string>={monstertype:w.monster,monstercount:String(n),delay:String(w.delay),
    m_imaxlivechildren:String(Math.min(n,Math.floor(w.maxLive/active.length)+(j<w.maxLive%active.length?1:0))),
    spawnflags:'32',spawn_mode:'0',trigger_condition:'4',trigger_target:dead,is_not_revivable:'1',
    is_player_ally:w.ally?'1':'0'};
   if(w.health>0)props.health=String(w.health);
   if(w.weapons>0)props.weapons=String(w.weapons);
   if(w.pathName)props.path_name=w.pathName;
   if(w.guardTarget)props.guard_ent=w.guardTarget;
   p('squadmaker',spawnName,spawn,props);
  });
  if(w.eventSequenceId)managerProps[eventTargetName(w.eventSequenceId)]='0';
  p('multi_manager',begin,plus(at,[0,0,40]),managerProps);
 }
 const winName=`${encounterPrefix(plan.id)}_completed`;
 p('game_text',winName,plus(base,[0,0,224]),{message:'SECTOR SECURED - ALL WAVES COMPLETE',x:'-1',y:'0.20',effect:'0',color:'100 240 180',color2:'100 240 180',fadein:'0.3',fadeout:'1',holdtime:'5',fxtime:'0',channel:'4'});
 const finishProps:Record<string,string>={[winName]:'0'};
 if(plan.missionStageId)finishProps[stageCompleteName(plan.missionStageId)]='0.1';
 if(plan.completionTarget)finishProps[plan.completionTarget]='0.1';
 p('multi_manager',encounterFinishName(plan.id),plus(base,[0,0,256]),finishProps);
 return result;
}
/** Cross-study dependency protection. Never silently break another editor's links. */
function referencedNames(project:Project,oldIds:Set<string>,disappearing:Set<string>):string[]{
 const referenced=new Set<string>();
 for(const entity of project.objects){if(!isPoint(entity)||oldIds.has(entity.id))continue;
  for(const key of ['target','killtarget','master','trigger_target'])if(disappearing.has(entity.props[key]))referenced.add(entity.props[key]);
  if(entity.classname==='multi_manager')for(const key of Object.keys(entity.props))if(disappearing.has(key.replace(/#\d+$/,'')))referenced.add(key);
 }
 for(const seq of project.eventSequences||[])for(const cue of seq.cues)if(disappearing.has(cue.target))referenced.add(cue.target);
 for(const mission of project.missionPlans||[])for(const stage of mission.stages){
  for(const n of [stage.output,stage.failureOutput])if(n&&disappearing.has(n))referenced.add(n);
 }
 return [...referenced];
}
function previousAndCheck(project:Project,id:string){
 const old=(project.encounterPlans||[]).find(x=>x.id===id);
 if(old)for(let i=0;i<old.memberIds.length;i++){
  const obj=project.objects.find(o=>o.id===old.memberIds[i]);
  if(!obj||obj.locked||signature(obj)!==old.signatures[i])throw Error('Encounter pieces were modified, removed or locked. Detach this encounter to preserve manual edits.');
 }
 return old;
}
export function saveEncounter(project:Project,plan:EncounterPlan):Project{
 const problems=encounterIssues(plan,project).filter(i=>i.level==='error');
 if(problems.length)throw Error(problems.map(i=>i.message).join(' | '));
 const old=previousAndCheck(project,plan.id);const prevIds=new Set(old?.memberIds||[]);
 const members=buildEncounterObjects(plan);if(members.length>MAX_ENTITIES_PER_PLAN)throw Error('Encounter exceeds safe native entity budget.');
 const newNames=new Set(members.filter(isPoint).map(e=>e.props.targetname).filter(Boolean));
 const lost=new Set(project.objects.filter(o=>prevIds.has(o.id)&&isPoint(o)).map(o=>(o as PointEntity).props.targetname).filter(n=>n&&!newNames.has(n)));
 const references=referencedNames(project,prevIds,lost);
 if(references.length)throw Error(`Generated targets still have external links: ${references.join(', ')}. Disconnect them or detach the encounter.`);
 const next={...plan,memberIds:members.map(m=>m.id),signatures:members.map(signature)};
 return {...project,objects:[...project.objects.filter(o=>!prevIds.has(o.id)),...members],encounterPlans:[...(project.encounterPlans||[]).filter(x=>x.id!==plan.id),next]};
}
export function removeEncounter(project:Project,id:string,detach=false):Project{
 const old=(project.encounterPlans||[]).find(x=>x.id===id);if(!old)throw Error('Encounter not found.');
 if(detach)return {...project,encounterPlans:(project.encounterPlans||[]).filter(x=>x.id!==id)};
 previousAndCheck(project,id);
 const own=new Set(old.memberIds);
 const names=new Set(project.objects.filter(o=>own.has(o.id)&&isPoint(o)).map(o=>(o as PointEntity).props.targetname).filter(Boolean));
 const refs=referencedNames(project,own,names);
 if(refs.length)throw Error(`Other entities still link to ${refs.join(', ')}. Detach instead or disconnect the links.`);
 return {...project,objects:project.objects.filter(o=>!own.has(o.id)),encounterPlans:(project.encounterPlans||[]).filter(x=>x.id!==id)};
}
/** Metadata structure must be validated before loading untrusted projects. */
export function validateEncounterMetadata(input:unknown):void{
 const p=input as Project;
 if(p.encounterPlans===undefined)return;
 if(!Array.isArray(p.encounterPlans)||p.encounterPlans.length>64)throw Error('Invalid project: encounter collection malformed.');
 const ids=new Set<string>(),waves=new Set<string>();
 for(const item of p.encounterPlans){
  if(!item||!safeId(item.id)||ids.has(item.id)||!text(item.name)||typeof item.description!=='string'||item.description.length>500||!vector(item.origin)||!['manual','trigger','auto'].includes(item.start)||
   typeof item.completionTarget!=='string'||!validExternal(item.completionTarget)||typeof item.missionStageId!=='string'||item.missionStageId.length>256||
   !Array.isArray(item.waves)||item.waves.length<1||item.waves.length>MAX_WAVES||
   !Array.isArray(item.memberIds)||item.memberIds.length>MAX_ENTITIES_PER_PLAN||!item.memberIds.every(x=>typeof x==='string'&&x.length<=256)||
   !Array.isArray(item.signatures)||item.memberIds.length!==item.signatures.length||!item.signatures.every(x=>typeof x==='string'&&x.length<=8192))throw Error('Invalid project: malformed encounter metadata.');
  ids.add(item.id);
  for(const w of item.waves){
   if(!w||!safeId(w.id)||waves.has(w.id)||!text(w.name,92)||!/^monster_[a-z0-9_]{1,70}$/i.test(w.monster)||
    !Number.isInteger(w.count)||w.count<1||w.count>MAX_WAVE_MONSTERS||!Number.isInteger(w.maxLive)||w.maxLive<1||w.maxLive>MAX_WAVE_MONSTERS||
    !Number.isFinite(w.delay)||w.delay<.2||w.delay>60||!Array.isArray(w.spawns)||w.spawns.length<1||w.spawns.length>MAX_SPAWNS||!w.spawns.every(vector)||
    typeof w.ally!=='boolean'||!Number.isInteger(w.health)||w.health<0||w.health>2000||!Number.isInteger(w.weapons)||w.weapons<0||w.weapons>512||
    typeof w.pathName!=='string'||!validExternal(w.pathName)||typeof w.guardTarget!=='string'||!validExternal(w.guardTarget)||
    typeof w.eventSequenceId!=='string'||w.eventSequenceId.length>256)throw Error('Invalid project: malformed NPC wave metadata.');
   waves.add(w.id);
  }
 }
}
