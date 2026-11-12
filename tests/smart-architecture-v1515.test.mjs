import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

const root=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-smart-architecture-'));
const modules=['types','geometry','exportMap','advancedModeling','modeling','architecture','architecturePlans','textureAxisSafety','valve220UV','customNpc','projectValidation','textureStudio'];
for(const name of modules){
 const source=fs.readFileSync(path.join(root,'src','engine',name+'.ts'),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace(/require\((['"])(\.\/[^'"]+)\.ts\1\)/g,'require($1$2.js$1)');
 const file=path.join(temp,'src','engine',name+'.js');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,output);
}
fs.writeFileSync(path.join(temp,'package.json'),' {"type":"commonjs"}');
fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
const require=createRequire(path.join(temp,'runner.cjs'));
const {createBrush,transformedVertices}=require('./src/engine/geometry.js');
const {createMultipleWallOpenings,architectureOpeningCenter,architectureOpeningMetrics,architecturePartSignature}=require('./src/engine/architecture.js');
const {buildArchitectureAssembly,replaceArchitectureAssembly,removeArchitectureAssembly,detachArchitectureAssembly,rebuildWallOpeningPlan}=require('./src/engine/architecturePlans.js');
const {validateBrush,exportBrush}=require('./src/engine/exportMap.js');
const {validateProjectFile}=require('./src/engine/projectValidation.js');
const options={width:128,height:160,depth:320,frame:8,steps:8,cutOnly:false,doorLeaf:false,openTop:false};
const wall=createBrush('box',[-400,800,160],[32,544,320],'Original West Wall');
wall.faces.forEach(face=>face.texture='SV_BRICK01');
const base=()=>({version:1,target:'svengine',name:'Smart Build test',world:{classname:'worldspawn'},wadNames:[],objects:[]});
const near=(a,b,epsilon=.01)=>assert.ok(a.every((v,i)=>Math.abs(v-b[i])<epsilon),`expected ${a} near ${b}`);

try {
 test('four new generators and legacy generators create sealed, convex Valve 220 brushes',()=>{
   for(const kind of ['corridor','platform','bridge','landingStairs','room','stairs','arch','frame','ramp','column']){
     const {record,objects}=buildArchitectureAssembly(kind,options,[352,800,32],'SV_BRICK01');
     assert.ok(objects.length>0,kind);assert.equal(record.memberIds.length,objects.length);
     assert.equal(record.signatures.length,objects.length);
     for(const brush of objects){
       assert.deepEqual(validateBrush(brush),[],`${kind}: ${brush.name}`);
       assert.match(exportBrush(brush),/SV_BRICK01/);
       assert.ok(transformedVertices(brush).every(p=>p.every(Number.isFinite)));
     }
   }
 });
 test('room and corridor ceiling toggle changes brush count without opening side walls',()=>{
   const full=buildArchitectureAssembly('room',options,[0,0,0],'SV_BRICK01');
   const open=buildArchitectureAssembly('room',{...options,openTop:true},[0,0,0],'SV_BRICK01');
   assert.equal(full.objects.length,6);assert.equal(open.objects.length,5);
   assert.equal(buildArchitectureAssembly('corridor',options,[0,0,0],'SV_BRICK01').objects.length,4);
   assert.equal(buildArchitectureAssembly('corridor',{...options,openTop:true},[0,0,0],'SV_BRICK01').objects.length,3);
 });
 test('parametric structure rebuild replaces only its own pieces and preserves other map objects',()=>{
   const created=buildArchitectureAssembly('landingStairs',options,[100,300,10],'SV_BRICK01');
   const other=createBrush('box',[1000,1000,100],[32,32,32]);
   const project={...base(),objects:[other,...created.objects],architectureAssemblies:[created.record]};
   const result=replaceArchitectureAssembly(project,created.record.id,{...options,steps:11,width:192},[400,250,64]);
   assert.equal(result.project.architectureAssemblies.length,1);
   assert.equal(result.project.architectureAssemblies[0].id,created.record.id);
   assert.equal(result.memberIds.length,12);assert.ok(result.project.objects.some(b=>b.id===other.id));
   assert.ok(!result.project.objects.some(b=>b.id===created.objects[0].id));
   assert.equal(project.objects[0],other,'source project is not mutated');
   for(const b of result.project.objects.filter(x=>x.kind==='brush'))assert.deepEqual(validateBrush(b),[]);
 });
 test('manual geometry or texture edits cannot be silently destroyed by a structure rebuild',()=>{
   const made=buildArchitectureAssembly('platform',options,[0,0,0],'SV_BRICK01');
   const project={...base(),objects:made.objects.map((b,i)=>i===0?{...b,faces:b.faces.map((f,j)=>j===0?{...f,texture:'SV_TILE01'}:f)}:b),architectureAssemblies:[made.record]};
   assert.throws(()=>replaceArchitectureAssembly(project,made.record.id,options,[32,0,0]),/manual changes/i);
   assert.throws(()=>removeArchitectureAssembly(project,made.record.id),/manual changes/i);
   const detached=detachArchitectureAssembly(project,made.record.id);
   assert.equal(detached.architectureAssemblies.length,0);assert.equal(detached.objects.length,project.objects.length);
 });
 test('removing an untouched assembly preserves unrelated geometry',()=>{
   const made=buildArchitectureAssembly('bridge',options,[0,0,0],'SV_BRICK01');
   const other=createBrush('box',[512,512,0],[32,32,32]);
   const out=removeArchitectureAssembly({...base(),objects:[other,...made.objects],architectureAssemblies:[made.record]},made.record.id);
   assert.deepEqual(out.objects.map(x=>x.id),[other.id]);assert.deepEqual(out.architectureAssemblies,[]);
 });
 test('parametric window can move and resize while retaining another opening on same wall',()=>{
   const a={id:'window-A',kind:'window',wall,center:architectureOpeningCenter(wall,'window',{...options,width:72,height:96},-130,80),options:{...options,width:72,height:96,depth:24},texture:'SV_BRICK01'};
   const b={id:'window-B',kind:'window',wall,center:architectureOpeningCenter(wall,'window',{...options,width:72,height:96},130,80),options:{...options,width:72,height:96,depth:24},texture:'SV_TILE01'};
   const first=createMultipleWallOpenings(wall,[a,b],'SV_BRICK01');
   const records=[a,b].map((r,i)=>({...r,memberIds:first.memberIds[i]}));
   const project={...base(),objects:first.objects,architectureOpenings:records};
   const resized={...a,options:{...a.options,width:88},center:architectureOpeningCenter(wall,'window',{...a.options,width:88},-120,64)};
   const result=rebuildWallOpeningPlan(project,wall.id,[resized,b],'SV_BRICK01');
   assert.equal(result.project.architectureOpenings.length,2);
   assert.deepEqual(result.project.architectureOpenings[1].center,b.center);
   assert.equal(result.project.architectureOpenings[1].texture,'SV_TILE01');
   assert.equal(result.members.length,2);
   assert.ok(result.project.objects.every(x=>validateBrush(x).length===0));
   assert.ok(result.project.objects.some(x=>x.name==='window / side frame'&&x.faces[0].texture==='SV_TILE01'));
 });
 test('deleting the final window reconstructs the exact original wall and UV',()=>{
   const opts={...options,width:80,height:96,depth:24};
   const rec={id:'window-A',kind:'window',wall,options:opts,center:architectureOpeningCenter(wall,'window',opts,0,80),texture:'SV_BRICK01'};
   const built=createMultipleWallOpenings(wall,[rec],'SV_BRICK01');
   const project={...base(),objects:built.objects,architectureOpenings:[{...rec,memberIds:built.memberIds[0]}]};
   const output=rebuildWallOpeningPlan(project,wall.id,[],'SV_BRICK01').project;
   assert.equal(output.objects.length,1);assert.deepEqual(output.objects[0],wall);
   assert.equal(output.architectureOpenings.length,0);
 });
 test('new window placements detect overlaps, wall limits and invalid parameters atomically',()=>{
   const opts={...options,width:96,height:96,depth:24};
   const first={id:'one',kind:'window',wall,options:opts,center:architectureOpeningCenter(wall,'window',opts,0,64),texture:'SV_BRICK01'};
   const built=createMultipleWallOpenings(wall,[first],'SV_BRICK01');
   const project={...base(),objects:built.objects,architectureOpenings:[{...first,memberIds:built.memberIds[0]}]};
   const second={...first,id:'two',center:architectureOpeningCenter(wall,'window',opts,32,64)};
   assert.throws(()=>rebuildWallOpeningPlan(project,wall.id,[first,second],'SV_BRICK01'),/overlap/i);
   assert.throws(()=>rebuildWallOpeningPlan(project,wall.id,[{...first,center:architectureOpeningCenter(wall,'window',opts,900,64)}],'SV_BRICK01'),/too close/i);
   assert.throws(()=>rebuildWallOpeningPlan(project,wall.id,[{...first,options:{...opts,width:9999}}],'SV_BRICK01'),/fit within|between 1 and 8192/i);
   assert.ok(project.objects.every(x=>validateBrush(x).length===0),'original state remains unchanged');
 });
 test('wall-relative offset and sill are reversible',()=>{
   const center=architectureOpeningCenter(wall,'window',options,-72,42);
   const result=architectureOpeningMetrics(wall,'window',options,center);
   assert.deepEqual(result,{offset:-72,sill:42});
 });
 test('generated architecture metadata is accepted by the project validator; malformed metadata is rejected',()=>{
   const made=buildArchitectureAssembly('room',options,[0,0,0],'SV_BRICK01');
   const project={...base(),objects:made.objects,architectureAssemblies:[made.record]};
   assert.equal(validateProjectFile(project).architectureAssemblies.length,1);
   assert.throws(()=>validateProjectFile({...project,architectureAssemblies:[{...made.record,origin:[NaN,0,0]}]}),/assembly/i);
 });
 test('opening provenance detects a manually moved or repainted wall section before rebuilding',()=>{
   const opts={...options,width:88,height:96};
   const rec={id:'tracked',kind:'window',wall,options:opts,
     center:architectureOpeningCenter(wall,'window',opts,0,80),texture:'SV_BRICK01'};
   const generated=createMultipleWallOpenings(wall,[rec],'SV_BRICK01');
   const old={...base(),objects:generated.objects,architectureOpenings:[{...rec,memberIds:generated.memberIds[0]}]};
   const first=rebuildWallOpeningPlan(old,wall.id,old.architectureOpenings,'SV_BRICK01').project;
   const current=first.architectureOpenings[0];
   assert.equal(current.memberSignatures.length,current.memberIds.length);
   const clean=rebuildWallOpeningPlan(first,wall.id,first.architectureOpenings,'SV_BRICK01');
   assert.ok(clean.project.objects.length>0);
   const touched={...first,objects:first.objects.map((part,i)=>i===0?{...part,position:[part.position[0]+8,part.position[1],part.position[2]]}:part)};
   assert.throws(()=>rebuildWallOpeningPlan(touched,wall.id,touched.architectureOpenings,'SV_BRICK01'),/manual changes/i);
 });
 test('legacy opening metadata remains loadable and new provenance is validated',()=>{
   const opts={...options,width:88,height:96};
   const rec={id:'tracked',kind:'window',wall,options:opts,
     center:architectureOpeningCenter(wall,'window',opts,0,80),texture:'SV_BRICK01'};
   const generated=createMultipleWallOpenings(wall,[rec],'SV_BRICK01');
   const initial={...base(),objects:generated.objects,architectureOpenings:[{...rec,memberIds:generated.memberIds[0]}]};
   assert.equal(validateProjectFile(initial).architectureOpenings.length,1);
   const signed=rebuildWallOpeningPlan(initial,wall.id,initial.architectureOpenings,'SV_BRICK01').project;
   assert.equal(validateProjectFile(signed).architectureOpenings.length,1);
   assert.throws(()=>validateProjectFile({...signed,architectureOpenings:[{...signed.architectureOpenings[0],memberSignatures:['invalid'] }]}),/provenance/i);
 });
 test('real Shapes menu mounts the Smart Build panel and wired editor actions',()=>{
   const shape=fs.readFileSync(path.join(root,'src','components','ShapePalette.tsx'),'utf8');
   const panel=fs.readFileSync(path.join(root,'src','components','ArchitectureBuilder.tsx'),'utf8');
   const store=fs.readFileSync(path.join(root,'src','store.ts'),'utf8');
   assert.match(shape,/<ArchitectureBuilder\/>/);assert.match(shape,/Architecture Mode<\/button>/);
   for(const action of ['editArchitectureOpening','removeArchitectureOpening','repeatArchitectureOpening','detachArchitectureWall','editArchitectureAssembly','deleteArchitectureAssembly','detachArchitectureAssembly']){
     assert.ok(panel.includes(action));assert.ok(store.includes(action));
   }
 });
} finally{fs.rmSync(temp,{recursive:true,force:true})}
