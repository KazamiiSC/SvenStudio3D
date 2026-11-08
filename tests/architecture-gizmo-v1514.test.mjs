/** v1.5.14: CSG wall fragments and legacy projects must have a gizmo at the visible geometry. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sv-gizmo-'));
try {
  // Compile the genuine engine into a temporary CommonJS directory. This
  // avoids Vite, React and platform-specific native dependencies.
  const engineFiles=['types','geometry','exportMap','modeling','advancedModeling','architecture','transformUX','gridPrecision','textureStudio','textureAxisSafety','valve220UV'];
  for(const name of engineFiles){
    const input=fs.readFileSync(path.join(root,'src','engine',`${name}.ts`),'utf8');
    const output=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace(/require\((['\"])(\.\/[^'\"]+)\.ts\1\)/g,'require($1$2.js$1)');
    const file=path.join(tmp,'src','engine',`${name}.js`);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,output);
  }
  fs.writeFileSync(path.join(tmp,'package.json'),' {"type":"commonjs"}');
  fs.symlinkSync(path.join(root,'node_modules'),path.join(tmp,'node_modules'),'dir');
  const require=createRequire(path.join(tmp,'runner.cjs'));
  const {createBrush,createArch,transformedVertices}=require('./src/engine/geometry.js');
  const {createMultipleWallOpenings,createArchitecture,centerArchitectureFragment}=require('./src/engine/architecture.js');
  const {selectionPivot,anchorPosition}=require('./src/engine/transformUX.js');
  const {validateBrush,exportBrush}=require('./src/engine/exportMap.js');
  const pos=(b)=>{
    const pts=transformedVertices(b);
    return [0,1,2].map(i=>(Math.min(...pts.map(p=>p[i]))+Math.max(...pts.map(p=>p[i])))/2);
  };
  const near=(a,b)=>assert.ok(a.every((v,i)=>Math.abs(v-b[i])<.00011),`expected ${a} ~= ${b}`);
  const wall=createBrush('box',[-400,800,160],[32,544,320],'West Wall');
  const options={width:96,height:112,depth:24,frame:8,steps:8,cutOnly:false,doorLeaf:false};
  const placement={kind:'window',center:[-400,800,175],options};
  const {objects,memberIds}=createMultipleWallOpenings(wall,[placement],'SV_BRICK01');
  test('a window rebuild creates centered wall pieces and preserves Svengine geometry',()=>{
    assert.ok(objects.length>4);assert.equal(memberIds.length,1);
    const pieces=objects.filter(o=>o.name.includes('wall section'));
    assert.ok(pieces.length>=3);
    assert.ok(pieces.some(b=>b.position.some(v=>v!==0)));
    for(const brush of objects){
      near(brush.position,pos(brush));
      near(selectionPivot(brush).toArray(),[pos(brush)[0],pos(brush)[2],-pos(brush)[1]]);
      assert.deepEqual(validateBrush(brush),[]);
      assert.match(exportBrush(brush),/\bSV_BRICK01\b/);
    }
  });
  test('recenter is geometry-preserving and independent of spawning position',()=>{
    const legacy={...objects[0],position:[0,0,0],vertices:transformedVertices(objects[0])};
    const before=transformedVertices(legacy);
    const fixed=centerArchitectureFragment(legacy);
    const after=transformedVertices(fixed);
    assert.deepEqual(after,before);
    near(fixed.position,pos(legacy));
    near(anchorPosition(legacy,'center').toArray(),selectionPivot(fixed).toArray());
    assert.deepEqual(validateBrush(fixed),[]);
  });
  test('existing saved CSG fragment keeps an accurate gizmo without altering its coordinates',()=>{
    const b=objects.find(o=>o.name.includes('wall section'));
    assert.ok(b);
    const legacy={...b,position:[0,0,0],vertices:transformedVertices(b)};
    const point=selectionPivot(legacy);
    near(point.toArray(),[pos(b)[0],pos(b)[2],-pos(b)[1]]);
    assert.notDeepEqual(point.toArray(),[0,0,0]);
    assert.deepEqual(validateBrush(legacy),[]);
  });
  test('moving a legacy wall section preserves its shape and moves it by the chosen delta',()=>{
    const piece=objects.find(o=>o.name.includes('wall section'));
    const legacy={...piece,position:[0,0,0],vertices:transformedVertices(piece)};
    const old=transformedVertices(legacy);
    const delta=[32,-48,16];
    const moved={...legacy,position:delta};
    const after=transformedVertices(moved);
    after.forEach((point,i)=>near(point,old[i].map((value,axis)=>value+delta[axis])));
    near(selectionPivot(moved).toArray(),[
      pos(legacy)[0]+delta[0],pos(legacy)[2]+delta[2],-(pos(legacy)[1]+delta[1])]);
    assert.deepEqual(validateBrush(moved),[]);
  });
  test('unmodified centered brushes keep their original gizmo positions',()=>{
    const normal=createBrush('box',[100,200,300],[64,128,32]);
    near(selectionPivot(normal).toArray(),[100,300,-200]);
    near(anchorPosition(normal,'center').toArray(),[100,300,-200]);
  });
  test('arch segments retain their intentional shared rotation pivot',()=>{
    const parts=createArch([320,720,64],160,112,64,8);
    assert.ok(parts.length>1);
    assert.equal(parts[0].primitive,'archSegment');
    near(selectionPivot(parts[0]).toArray(),[320,64,-720]);
  });
  test('multiple door/window cuts still produce centered, exportable wall fragments',()=>{
    const door={kind:'door',center:[-400,650,96],options:{...options,height:128}};
    const window={kind:'window',center:[-400,920,175],options};
    const result=createMultipleWallOpenings(wall,[door,window],'SV_BRICK01');
    assert.equal(result.memberIds.length,2);
    for(const b of result.objects){
      assert.deepEqual(validateBrush(b),[]);
      if(b.name.includes('wall section'))near(b.position,pos(b));
    }
  });
  test('viewport selection explicitly uses visible geometry for all selected members',()=>{
    const viewport=fs.readFileSync(path.join(root,'src/components/Viewport.tsx'),'utf8');
    assert.match(viewport,/const positions=members\.map\(selectionPivot\)/);
    assert.match(viewport,/import \{anchorPosition,selectionPivot,anchoredPose/);
  });
  test('standalone architecture windows also create fragments with a correct transform origin',()=>{
    const built=createArchitecture('window',options,wall,'SV_BRICK01',{center:[-400,800,175]});
    for(const b of built.objects){near(b.position,pos(b));assert.deepEqual(validateBrush(b),[]);}
  });
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
