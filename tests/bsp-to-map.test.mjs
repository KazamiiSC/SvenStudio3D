import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {decompileBspToMap} from '../server/surfDecompile.js';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(require('node:fs').readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {inspectMapImport}=require('../src/engine/importMap.ts');
const bsp=Buffer.alloc(125);bsp.writeInt32LE(30,0);
for(let i=0;i<15;i++){bsp.writeInt32LE(124,4+i*8);bsp.writeInt32LE(0,8+i*8)}
const original=Buffer.from(bsp);
const fixture=await fs.readFile(new URL('../examples/gameplay_button_relay_door.map',import.meta.url),'utf8');
async function tempTool(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sven-bsp-map-test-'));
 const tool=path.join(root,'surfdecomp.exe'),map=path.join(root,'fixture.map');
 await fs.writeFile(map,fixture);
 await fs.writeFile(tool,`#!/bin/sh\nif [ "$1" != "decompile" ] || [ "$3" != "-o" ]; then exit 3; fi\ncp "${map}" "$4"\n`);
 await fs.chmod(tool,0o755);
 return {root,tool};
}
test('reject malformed BSP before executing tool',async()=>{
 const {root,tool}=await tempTool();try{
  await assert.rejects(decompileBspToMap({bsp:Buffer.alloc(124),toolPath:tool}),/version 30/);
  const bad=Buffer.from(original);bad.writeInt32LE(-3,4);
  await assert.rejects(decompileBspToMap({bsp:bad,toolPath:tool}),/Invalid BSP lump/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('requires explicit SurfDecomp.exe program name and absolute path',async()=>{
 await assert.rejects(decompileBspToMap({bsp,toolPath:'/usr/bin/unknown.exe'}),/surfdecomp.exe/);
 await assert.rejects(decompileBspToMap({bsp,toolPath:'surfdecomp.exe'}),/absolute path/);
});
test('BSP to MAP conversion creates valid text and never mutates input BSP',async()=>{
 const {root,tool}=await tempTool();try{
  const result=await decompileBspToMap({bsp,toolPath:tool});
  assert.equal(result.mapText,fixture);
  assert.ok(result.mapText.includes('"classname" "worldspawn"'));
  assert.ok(result.mapText.includes('"classname" "info_player_start"'));
  const inspected=inspectMapImport(result.mapText,'test_recovered.map');
  assert.ok(inspected.report.totalBrushes>0);
  assert.equal(inspected.report.skippedBrushes,0);
  assert.ok(inspected.project.objects.some(object=>object.kind==='entity'&&object.classname==='info_player_start'));
  assert.deepEqual(bsp,original);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('reject decompiler failures and bogus MAP output',async()=>{
 const {root,tool}=await tempTool();try{
  await fs.writeFile(tool,'#!/bin/sh\nexit 5\n');
  await assert.rejects(decompileBspToMap({bsp,toolPath:tool}),/SurfDecomp failed/);
  await fs.writeFile(tool,'#!/bin/sh\nprintf "not a Valve map" > "$4"\n');
  await assert.rejects(decompileBspToMap({bsp,toolPath:tool}),/was not created|not a recognizable/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
