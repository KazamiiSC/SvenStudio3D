import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'gds173-'));
for(const file of ['gameplayMap2d']){
 const source=fs.readFileSync(path.join(root,'src/engine',file+'.ts'),'utf8');
 const {outputText,diagnostics}=ts.transpileModule(source,{fileName:file+'.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 assert.equal(diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length||0,0);
 fs.writeFileSync(path.join(temp,file+'.js'),outputText);
}
const map=require(path.join(temp,'gameplayMap2d.js'));
const box=(id,x=0,y=0,z=0,rz=0)=>({id,kind:'brush',primitive:'box',name:id,position:[x,y,z],rotation:[0,0,rz],scale:[1,1,1],hidden:false,
 vertices:[[-64,-32,-16],[64,-32,-16],[64,32,-16],[-64,32,-16],[-64,-32,16],[64,-32,16],[64,32,16],[-64,32,16]],faces:[]});
const ent=(id,x,y,z)=>({id,kind:'entity',classname:'light',name:id,position:[x,y,z],props:{}});
test('world transform yields a mathematically stable hull instead of a fake diamond',()=>{
 const b=box('wall',100,150,40,90),before=JSON.stringify(b),o=map.brushMapOutline(b,'top');
 assert.equal(o.polygon.length,4);assert.ok(Math.abs(o.bounds.maxX-o.bounds.minX-64)<.001);
 assert.ok(Math.abs(o.bounds.maxY-o.bounds.minY-128)<.001);
 assert.ok(o.polygon.every(p=>p.every(Number.isFinite)));assert.equal(JSON.stringify(b),before);
});
test('ISO projection is the convex silhouette of actual 3D points and is stable at every zoom',()=>{
 const b=box('iso',250,-40,60,30);const outline=map.brushMapOutline(b,'iso');
 assert.ok(outline.polygon.length>=4);
 const view={cx:11,cy:23,scale:.29},point=outline.polygon[0];
 for(let i=0;i<35;i++){
  const mouse=[200+i%12,175+i%7];const next=map.mapZoomAt(view,1.11,mouse,900,620);
  const before=map.mapScreenToWorld(mouse,view,900,620),after=map.mapScreenToWorld(mouse,next,900,620);
  assert.ok(Math.hypot(before[0]-after[0],before[1]-after[1])<1e-8);
  const screen=map.mapWorldToScreen(point,next,900,620);assert.deepEqual(map.mapScreenToWorld(screen,next,900,620).map(v=>Math.round(v*1e6)),point.map(v=>Math.round(v*1e6)));
 }
});
test('overlapping map entities remain individually selectable through a stable stack, including different elevations',()=>{
 const markers=[{id:'above',x:100,y:100,z:400},{id:'below',x:100,y:100,z:-128},{id:'beside',x:240,y:100,z:10}];
 const groups=map.groupMapMarkers(markers,17);
 assert.equal(groups.length,2);assert.deepEqual(groups.find(g=>g.members.includes('above')).members,['above','below']);
 assert.deepEqual(map.groupMapMarkers(markers.toReversed(),17),groups);
 assert.equal(map.inHeightSlice(400,400,64),true);assert.equal(map.inHeightSlice(-128,400,64),false);
});
test('layer filtering does not modify the brush or the project',()=>{
 const b=box('brush',0,0,256),snapshot=JSON.stringify(b);
 const outline=map.brushMapOutline(b,'top');assert.ok(!map.brushIntersectsHeight(outline,-500,60));
 assert.ok(map.brushIntersectsHeight(outline,256,60));assert.equal(JSON.stringify(b),snapshot);
 const hidden={...b,hidden:true};assert.equal(map.brushMapOutline(hidden,'top'),null);
});
test('large maps have bounded grouping work and no data changes',()=>{
 const entities=Array.from({length:4000},(_,i)=>ent('e'+i,(i%40)*64,Math.floor(i/40)*64,i%4*256));
 const before=JSON.stringify(entities);const markers=entities.map(e=>({id:e.id,x:e.position[0],y:e.position[1],z:e.position[2]}));
 const groups=map.groupMapMarkers(markers,17);assert.equal(groups.length,4000);assert.equal(JSON.stringify(entities),before);
});
test('the new UI exposes height filtering, stacked selection and real geometry paths without touching editing APIs',()=>{
 const file=fs.readFileSync(path.join(root,'src/components/GameplayStudio.tsx'),'utf8');
 const parsed=ts.createSourceFile('GameplayStudio.tsx',file,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,parsed.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('; '));
 for(const name of ['brushMapOutline','groupMapMarkers','gds-stack-menu','heightMode','mapZoomAt','brushIntersectsHeight','onSelect(id)','connect(fromId,toId)','setProp(current.id'])assert.ok(file.includes(name),name);
 assert.ok(!file.includes('Math.min(208,ctx.measureText'));
});
