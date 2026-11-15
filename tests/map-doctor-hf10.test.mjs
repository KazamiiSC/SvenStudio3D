import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMap} from '../src/engine/mapDiagnostics.ts';
import {exportMap,validateProject} from '../src/engine/exportMap.ts';
import {primitiveGeometry} from '../src/engine/geometry.ts';
import {SVEN_PLAYER_SPAWNS,isSvenPlayerSpawn,hasStaticSvenTarget} from '../src/engine/svenEntitySemantics.ts';
import {analyzeBuildLog,parsePointfile} from '../src/engine/compileDiagnostics.ts';

const entity=(id,classname,props={},position=[0,0,48])=>({kind:'entity',id,name:classname,classname,props,position});
const solid=(id='world',tex='BRICK')=>({kind:'brush',id,name:id,primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],...primitiveGeometry('box',[256,256,256]),faces:primitiveGeometry('box',[256,256,256]).faces.map(f=>({...f,texture:tex}))});
const project=(objects)=>({name:'Doctor Test',version:1,target:'svengine',world:{classname:'worldspawn'},wadNames:[],objects});
const codes=p=>analyzeMap(p).issues.map(issue=>issue.code);

for(const classname of SVEN_PLAYER_SPAWNS){
 test(`HF10 supports ${classname} in both Map Doctor and build preflight`,()=>{
  const p=project([solid(),entity('spawn',classname)]);
  assert.equal(codes(p).includes('NO_SPAWN'),false);
  assert.deepEqual(validateProject(p),[]);
  assert.match(exportMap(p),new RegExp(`"classname" "${classname}"`));
  assert.equal(isSvenPlayerSpawn(classname.toUpperCase()),true);
 });
}
test('HF10 retains error for maps lacking all four player spawns, including empty maps',()=>{
 for(const p of [project([solid(),entity('light','light')]),project([])]){
  assert.equal(codes(p).includes('NO_SPAWN'),true);
  assert.ok(validateProject(p).some(error=>error.includes('player spawn')));
 }
 assert.ok(codes(project([])).includes('NO_BRUSHES'));
});
test('HF10 does not consider an ordinary info_target a player spawn',()=>{
 const p=project([solid(),entity('t','info_target')]);
 assert.ok(codes(p).includes('NO_SPAWN'));
});
test('HF10 prefix wildcards match real targets and killtargets, including grouped brush entities',()=>{
 const door=entity('door','func_door',{targetname:'action_door'});
 const wall=entity('wall','func_wall',{targetname:'action_wall'});
 const trigger=entity('trigger','trigger_relay',{target:'action_*',killtarget:'action_*'});
 const p=project([solid(),{...solid('brush-of-door'),entityId:'door'},entity('spawn','info_player_deathmatch'),door,wall,trigger]);
 assert.equal(codes(p).includes('MISSING_TARGET'),false);
 assert.equal(validateProject(p).length,0);
});
test('HF10 detects truly missing exact and wildcard target names, including killtarget',()=>{
 const trigger=entity('trigger','trigger_relay',{target:'does_not_exist',killtarget:'action_missing_*'});
 const p=project([solid(),entity('spawn','info_player_start'),trigger,entity('door','func_door',{targetname:'action_door'})]);
 const missing=analyzeMap(p).issues.filter(issue=>issue.code==='MISSING_TARGET');
 assert.equal(missing.length,2);
 assert.equal(missing.every(issue=>issue.severity==='warning'&&issue.objectId==='trigger'),true);
});
test('HF10 recognizes runtime references without inventing static targets',()=>{
 const p=project([solid(),entity('spawn','info_player_dm2'),entity('relay','trigger_relay',{target:'!activator',killtarget:'!caller'})]);
 assert.equal(codes(p).includes('MISSING_TARGET'),false);
 assert.equal(hasStaticSvenTarget('!activator',new Set()),true);
 assert.equal(hasStaticSvenTarget('!caller',new Set()),true);
});
test('HF10 only interprets an asterisk at the end as a prefix wildcard',()=>{
 const names=new Set(['action_door','action_wall','other']);
 assert.equal(hasStaticSvenTarget('action_*',names),true);
 assert.equal(hasStaticSvenTarget('ACTION_*',names),false);
 assert.equal(hasStaticSvenTarget('action*other',names),false);
 assert.equal(hasStaticSvenTarget('action_*_other',names),false);
 assert.equal(hasStaticSvenTarget('action_missing*',names),false);
 assert.equal(hasStaticSvenTarget('*',names),true);
 assert.equal(hasStaticSvenTarget('action_door',names),true);
 assert.equal(hasStaticSvenTarget('action_door ',names),true);
});
test('HF10 solid SKY warning applies to all supported spawn classes',()=>{
 for(const classname of SVEN_PLAYER_SPAWNS){
  const p=project([solid('sky','SKY'),entity('spawn',classname,{},[0,0,0])]);
  assert.ok(codes(p).includes('SOLID_SKY_SPACE'),classname);
 }
});
test('HF10 report does not mutate project or change WAD previews/FGD warnings',()=>{
 const p=project([solid(),entity('spawn','info_player_start'),entity('custom','my_custom_class',{target:'missing'})]);
 const before=JSON.stringify(p);
 const report=analyzeMap(p,[],[],true);
 assert.equal(JSON.stringify(p),before);
 assert.ok(report.issues.some(issue=>issue.code==='UNKNOWN_FGD'));
 assert.ok(report.issues.some(issue=>issue.code==='NO_WAD_PREVIEW'));
 assert.ok(report.issues.some(issue=>issue.code==='MISSING_TARGET'));
});
test('HF10 leaves compiler findings and leak pointfiles unchanged',()=>{
 assert.equal(analyzeBuildLog(['LEAK in hull 0']).find(issue=>issue.code==='BSP_LEAK')?.stage,'BSP');
 assert.deepEqual(parsePointfile('0 0 0\n128 64 32'),[[0,0,0],[128,64,32]]);
});
