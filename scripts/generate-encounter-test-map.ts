/** Generates a self-contained v1.8.11 encounter demo project and Valve 220 MAP.
 * Usage: node scripts/run-ts.cjs scripts/generate-encounter-test-map.ts
 * Geometry: closed convex brushes, sealed test facility, static lights/cover.
 * NPC progression: native squadmaker death trigger -> game_counter -> next wave.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createBrush} from '../src/engine/geometry';
import {exportMap,validateBrush} from '../src/engine/exportMap';
import {inspectMapImport} from '../src/engine/importMap';
import {validateProjectFile} from '../src/engine/projectValidation';
import {uid,type Brush,type PointEntity,type Project,type Vec3} from '../src/engine/types';
import {createEncounterPreset,saveEncounter,encounterIssues,encounterStartName,encounterFinishName} from '../src/engine/npcEncounters';
import {createMissionPreset,createEventPreset,applyRecord,stageCompleteName} from '../src/engine/missionEvents';
import {validateNpcLogic} from '../src/engine/npc';

const here=path.resolve(process.cwd(),'examples','npc-encounters-v1811');fs.mkdirSync(here,{recursive:true});
const objects:Project['objects']=[];
const put=(name:string,at:Vec3,size:Vec3,texture='SV_CONCRET',layer='Geometry')=>{
 const b=createBrush('box',at,size,name);b.faces=b.faces.map(f=>({...f,texture}));b.layer=layer;objects.push(b);return b;
};
const ent=(classname:string,at:Vec3,props:Record<string,string>={},layer='Gameplay')=>{
 const p:PointEntity={id:uid(),kind:'entity',name:classname,classname,position:at,props,layer};objects.push(p);return p;
};
const brushEntity=(classname:string,at:Vec3,size:Vec3,props:Record<string,string>,tex='AAATRIGGER')=>{
 const e=ent(classname,at,props);
 const b=put(`${classname}: ${props.targetname||props.target}`,at,size,tex,'Gameplay');b.entityId=e.id;return e;
};
// Heavy, continuous and sealed perimeter: build with 64u thickness walls and ceiling.
put('Foundation / continuous world seal',[0,0,-32],[1920,1408,64],'SV_TILE01');
put('Ceiling / hide in editor to inspect map',[0,0,416],[1920,1408,64],'SV_CONCRET').hidden=true;
for(const x of [-992,992])put('Exterior reinforced wall',[x,0,192],[64,1472,384],'SV_CONCRET');
for(const y of [-736,736])put('Exterior reinforced wall',[0,y,192],[2048,64,384],'SV_CONCRET');
// Lobby, main combat hall and extraction room. The extraction sliding door
// needs a real brush-free pocket on its +Y travel side; otherwise func_door
// clips into the world partition and can become stuck after the final wave.
for(const x of [-440,440]){
 put('Hall partition - lower bay',[x,-440,192],[48,496,384],'SV_BRICK01');
 if(x<0)put('Hall partition - upper bay',[x,440,192],[48,496,384],'SV_BRICK01');
 else put('Hall partition - upper bay (door pocket)',[x,550,192],[48,276,384],'SV_BRICK01');
 put('Upper doorway bulkhead',[x,0,316],[48,384,136],'SV_METAL01');
}
// The first threshold is an open passage. At extraction the south shoulder
// stops at -120; the +Y side is a recessed door pocket (Z below 248 clear).
for(const x of [-440,440]){
 put('Doorway shoulder',[x,-156,124],[48,72,248],'SV_CONCRET');
 if(x<0)put('Doorway shoulder',[x,156,124],[48,72,248],'SV_CONCRET');
 else put('Pocket header above sliding gate',[x,300,316],[48,240,136],'SV_METAL01');
}
// Distinct zone floor markings, no collision barriers in walking lanes.
for(const x of [-725,-550,-360,0,360,590,780])put('Safety floor stripe',[x,0,2],[12,720,4],'SV_METAL01');
for(const y of [-520,520])put('Combat hall curb',[0,y,24],[820,32,48],'SV_METAL01');
// Wall panels and columns to give scale, avoid placing against spawn volumes.
for(const x of [-355,-100,160,350])for(const y of [-620,620]){
 put('Support column',[x,y,148],[32,64,296],'SV_METAL01');
 put('Support column foot',[x,y,11],[56,82,22],'SV_CONCRET');
}
for(const x of [-270,0,270])put('Overhead structural beam',[x,0,378],[24,1296,40],'SV_METAL01');
// Combat cover: central stacks with walkable gaps and a visible retreat lane.
for(const [x,y,z,h] of [[-260,-235,40,80],[-260,235,40,80],[-40,-300,60,120],[-40,300,60,120],[70,0,48,96],[210,0,56,112],[0,-90,32,64],[0,95,32,64]] as Array<[number,number,number,number]>){
 put('Tactical concrete barricade',[x,y,z],[88,64,h],'SV_CONCRET');
 put('Barricade upper edge',[x,y,z+h/2+5],[96,70,10],'SV_METAL01');
}
// Safe room infrastructure and recommended supplies.
put('Spawn equipment bench',[-760,-310,30],[180,72,60],'SV_METAL01');
put('Spawn bench shelf',[-760,-310,72],[190,82,12],'SV_TILE01');
put('Control wall panel',[-780,650,100],[140,14,180],'SV_METAL01');
for(const [i,y] of [-128,-32,64,160].entries())ent('info_player_start',[-770,y,48],{angles:'0 0 0'});
for(const [cls,x,y] of [['weapon_9mmAR',-780,-265],['weapon_shotgun',-720,-265],['ammo_9mmAR',-650,-265],['ammo_buckshot',-605,-265],['item_healthkit',-570,-265],['item_battery',-530,-265]] as const)ent(cls,[x,y,56]);
// Balanced local lights; no external lighting RAD files required.
for(const [x,y,r,g,b,power] of [[-700,0,255,235,205,350],[-420,0,180,225,255,300],[-220,420,225,235,255,320],[0,0,245,230,210,420],[230,-420,225,230,255,320],[520,0,170,240,255,280],[735,0,180,255,220,310]] as const)
 ent('light',[x,y,304],{_light:`${r} ${g} ${b} ${power}`},'Lighting');
for(const y of [-570,570])ent('light_spot',[120,y,330],{_light:'255 230 180 380',pitch:'-90',_cone:'45',_cone2:'70'},'Lighting');
// Functional exit gate, moving laterally into the adjacent partition. Closed until waves clear.
brushEntity('func_door',[440,0,119],[48,238,238],{targetname:'test_gate_open',speed:'145',wait:'-1',lip:'8',angle:'90',spawnflags:'0'},'SV_METAL01');
// Decorative exit frame outside the moving brush's travel volume.
// Keep the positive frame outside the slide pocket (the gate moves toward +Y).
for(const y of [-143,400])put('Exit access frame',[440,y,135],[80,24,270],'SV_METAL01');
put('Exit indicator lamp frame',[514,0,280],[16,170,20],'SV_METAL01');
// Native feedback targets shared with the two existing Studios.
ent('game_text',[-710,90,170],{targetname:'test_briefing',message:'BREACH DRILL: ENTER THE ARENA AND CLEAR ALL WAVES',x:'-1',y:'0.32',color:'120 220 245',holdtime:'6',fadein:'0.4',fadeout:'1',channel:'3'});
ent('game_text',[0,-40,180],{targetname:'test_alarm_message',message:'SECURITY ALERT! HOSTILES IN THE FACILITY',x:'-1',y:'0.31',color:'255 145 95',holdtime:'4',fadein:'0.2',fadeout:'1',channel:'3'});
ent('game_text',[40,0,180],{targetname:'test_final_message',message:'CRITICAL THREAT: FINAL WAVE INBOUND',x:'-1',y:'0.31',color:'255 90 90',holdtime:'4',fadein:'0.2',fadeout:'1',channel:'3'});
ent('game_text',[740,0,190],{targetname:'test_victory',message:'TEST PASSED! EXTRACTION REACHED. ALL SYSTEMS COMPLETE.',x:'-1',y:'0.32',color:'130 250 190',holdtime:'9',fadein:'0.3',fadeout:'1',channel:'3'});
ent('light',[0,-575,280],{targetname:'test_warning_light',_light:'255 55 40 260',spawnflags:'1'},'Lighting');
ent('light',[350,575,280],{targetname:'test_final_light',_light:'255 40 40 300',spawnflags:'1'},'Lighting');
brushEntity('trigger_once',[-710,0,76],[160,280,144],{target:'test_briefing',spawnflags:'0'});
// Three fully connected systems: intro Mission, alarms Events, death-gated Encounter.
let project:Project={version:1,target:'svengine',name:'sv_encounter_validation',world:{classname:'worldspawn',mapversion:'220',message:'SvenStudio 3D - Smart NPC Encounters 2.0 test map',skyname:'desert',wad:'svstudio.wad;'},wadNames:['svstudio.wad'],objects};
const alarm=createEventPreset('blank');alarm.name='Security lockdown warning';alarm.description='Announcement followed by a warning light.';alarm.origin=[-100,-100,96];alarm.cues=[{id:uid(),at:0.1,target:'test_alarm_message',mode:'toggle',note:'Initial warning'},{id:uid(),at:0.8,target:'test_warning_light',mode:'on',note:'Emergency lighting'}];
project=applyRecord(project,alarm,'event').project;
const finale=createEventPreset('blank');finale.name='Final assault alert';finale.description='Last-wave alarm light and announcement.';finale.origin=[-100,-200,96];finale.cues=[{id:uid(),at:0.1,target:'test_final_message',mode:'toggle',note:'Final assault starts'},{id:uid(),at:1.2,target:'test_final_light',mode:'on',note:'Red warning light'}];
project=applyRecord(project,finale,'event').project;
const mission=createMissionPreset('blank');mission.name='Breach drill: hold the sector';mission.origin=[-640,420,96];mission.autoStart=true;
mission.stages=[{id:uid(),title:'Eliminate all hostile waves',description:'Enter the combat arena and clear three enemy waves. Death counters determine success.',sequenceId:'',output:''},{id:uid(),title:'Reach extraction',description:'Proceed through the gate opened after the final enemy dies.',sequenceId:'',output:'test_victory'}];
project=applyRecord(project,mission,'mission').project;
const encounter=createEncounterPreset('mixed',[0,0,0]);encounter.name='Black Mesa: Security Breach';encounter.description='Arena encounter: HECU soldiers, zombies, alien grunts; native death counters progress waves.';encounter.start='trigger';encounter.missionStageId=mission.stages[0].id;encounter.completionTarget='test_gate_open';
encounter.waves[0]={...encounter.waves[0],name:'HECU security team',monster:'monster_human_grunt',count:4,maxLive:4,delay:0.5,spawns:[[70,-360,48],[70,360,48],[260,-360,48],[260,360,48]],weapons:1,eventSequenceId:alarm.id};
encounter.waves[1]={...encounter.waves[1],name:'Containment breach - zombies',monster:'monster_zombie',count:3,maxLive:3,delay:0.8,spawns:[[270,-400,48],[270,400,48],[295,130,48]]};
encounter.waves[2]={...encounter.waves[2],name:'Alien counterattack',monster:'monster_alien_grunt',count:2,maxLive:2,delay:1,spawns:[[200,-430,48],[200,430,48]],eventSequenceId:finale.id};
project=saveEncounter(project,encounter);
brushEntity('trigger_once',[690,0,75],[160,260,150],{target:stageCompleteName(mission.stages[1].id),spawnflags:'0'});
// The final trigger is world scenery authored after the generated record; append all.
project.objects=[...objects,...project.objects.filter(o=>!objects.some(original=>original.id===o.id))];
// Important: generator objects were created against the earlier project; manual new trigger is included.
const validation=validateProjectFile(JSON.parse(JSON.stringify(project)));
const errors=project.objects.filter((o):o is Brush=>o.kind==='brush').flatMap(b=>validateBrush(b));
if(errors.length)throw Error(`Invalid brush geometry: ${errors.slice(0,15).join(' | ')}`);
const npcIssues=validateNpcLogic(project.objects).filter(i=>i.severity==='error');if(npcIssues.length)throw Error(npcIssues.map(i=>i.message).join(' | '));
const issues=encounterIssues(encounter,project).filter(x=>x.level==='error');if(issues.length)throw Error(issues.map(x=>x.message).join(' | '));
const map=exportMap(project,['svstudio.wad']);
const checked=inspectMapImport(map,'sv_encounter_validation.map');
if(checked.report.skippedBrushes)throw Error(`Roundtrip lost ${checked.report.skippedBrushes} of ${checked.report.totalBrushes} brushes.`);
fs.writeFileSync(path.join(here,'sv_encounter_validation.map'),map,'utf8');
fs.writeFileSync(path.join(here,'sv_encounter_validation.svenstudio.json'),JSON.stringify(validation,null,2)+'\n','utf8');
fs.copyFileSync(path.resolve('public/svstudio.wad'),path.join(here,'svstudio.wad'));
const report={brushes:project.objects.filter(o=>o.kind==='brush').length,pointEntities:project.objects.filter(o=>o.kind==='entity').length,waves:encounter.waves.map(w=>({name:w.name,monster:w.monster,count:w.count})),missionStages:mission.stages.map(s=>s.title),events:[alarm.name,finale.name],roundTrip:checked.report,startTarget:encounterStartName(encounter.id),finishTarget:encounterFinishName(encounter.id)};
fs.writeFileSync(path.join(here,'BUILD_REPORT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
