import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cine-preview-test-'));
try{
  for(const f of ['types','geometry','gameplay','cinematic','cinematicPreview']){
    const source=fs.readFileSync(path.join(root,'src/engine',f+'.ts'),'utf8');
    const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
    fs.mkdirSync(path.join(tmp,'src/engine'),{recursive:true});
    fs.writeFileSync(path.join(tmp,'src/engine',f+'.js'),result.outputText);
  }
  fs.writeFileSync(path.join(tmp,'package.json'),JSON.stringify({type:'commonjs'}));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(tmp,'node_modules'),'dir');
  const require=createRequire(path.join(tmp,'entry.cjs'));
  const {createBrush}=require('./src/engine/geometry.js');
  const {pointInsideCinematicBrush}=require('./src/engine/cinematicPreview.js');
  const brush=createBrush('box',[100,-50,200],[100,150,80]);
  const source=JSON.stringify(brush);
  assert.equal(pointInsideCinematicBrush(brush,[100,-50,200]),true);
  assert.equal(pointInsideCinematicBrush(brush,[170,-50,200]),false);
  assert.equal(pointInsideCinematicBrush(brush,[100,-150,200]),false);
  assert.equal(pointInsideCinematicBrush(brush,[100,-50,300]),false);
  brush.rotation=[0,0,45];
  assert.equal(pointInsideCinematicBrush(brush,[100,-50,200]),true);
  assert.equal(pointInsideCinematicBrush(brush,[220,-50,200]),false);
  assert.notEqual(JSON.stringify(brush),source,'rotation fixture mutated intentionally');
  const before=JSON.stringify(brush);
  pointInsideCinematicBrush(brush,[100,-50,200]);
  assert.equal(JSON.stringify(brush),before,'collision diagnostic must not mutate brushes');
  const text=fs.readFileSync(path.join(root,'src/components/CinematicCameraStudio.tsx'),'utf8');
  assert.match(text,/scale:\[number,number,number\]=\[object\.scale\[0\],object\.scale\[2\],object\.scale\[1\]\]/);
  assert.match(text,/getPreviewTexture\(face\.texture,assets\)/);
  assert.match(text,/mode==='inspect'/);
  assert.match(text,/pointInsideCinematicBrush/);
  console.log('PASS Cinematic preview: convex collision diagnostics, scale axes, texture materials, inspection controls');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
