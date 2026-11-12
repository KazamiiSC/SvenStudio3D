import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {parseLeakPointfile,readBuildLeakPointfile} from '../server/leakPointfile.js';
const text=`(0 0 48)\n32 0 48\n64 0 48\n64 0 48\n128 0 48\n`;
const points=parseLeakPointfile(text);
assert.deepEqual(points,[[0,0,48],[32,0,48],[64,0,48],[128,0,48]]);
assert.deepEqual(parseLeakPointfile('garbage\n1 2 3'),[]);
assert.deepEqual(parseLeakPointfile('Infinity 2 3\n1 2 3\n4 5 6'),[[1,2,3],[4,5,6]]);
assert.deepEqual(parseLeakPointfile('x'.repeat(1024*1024+1)),[]);
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'mapdoctor-check-'));
try{
 const base=path.join(folder,'maptest');
 assert.equal(await readBuildLeakPointfile(base),null);
 await fs.writeFile(`${base}.pts`,text);
 assert.deepEqual((await readBuildLeakPointfile(base))?.points,points);
 await fs.writeFile(`${base}.pts`,'not-a-route');
 await fs.writeFile(`${base}.lin`,'1 2 3\n5 8 13\n');
 assert.equal((await readBuildLeakPointfile(base))?.extension,'.lin');
}finally{await fs.rm(folder,{recursive:true,force:true});}
const src=await fs.readFile('src/engine/compileDiagnostics.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('module','exports',js)(module,module.exports);
const {parsePointfile,validateTrace,analyzeBuildLog,renderDoctorMessage}=module.exports;
assert.deepEqual(parsePointfile(text),points);
assert.deepEqual(validateTrace(points),points);
assert.deepEqual(validateTrace([['1',2,3],[1,2,3]]),[]);
assert.deepEqual(validateTrace([[1,2,3],[Infinity,2,3]]),[]);
assert.deepEqual(parsePointfile('3.1e2 -22 4\n0 3 9'),[[310,-22,4],[0,3,9]]);
const errors=analyzeBuildLog([
 'Warning: === LEAK in hull 0 ===','Warning: === LEAK in hull 1 ===',
 'VIS exited with code 1. Check log for leaks',
 'Create Patches : 0 base patches','RAD exited with code 3221225477.'
]);
assert.deepEqual(errors.map(f=>f.code),['BSP_LEAK','RAD_NO_PATCHES','RAD_CRASH']);
assert.equal(errors[0].params.hulls,'0, 1');
assert.ok(renderDoctorMessage('hulls {hulls}',errors[0].params).includes('0, 1'));
assert.equal(analyzeBuildLog(['SC-BSP finished successfully.','SC-RAD finished successfully.']).length,0);
assert.deepEqual(analyzeBuildLog(['Illegal Brush: plane with no normal.']).map(f=>f.code),['INVALID_BRUSH']);
assert.deepEqual(analyzeBuildLog(['VIS exited with code 1']).map(f=>f.code),['VIS_FAILED']);
for(const file of ['src/components/MapDoctor.tsx','src/components/Viewport.tsx','src/App.tsx','server/index.js']){
 const content=await fs.readFile(file,'utf8');
 assert.ok(content.includes('useMapDoctorState')||content.includes('readBuildLeakPointfile'),`${file} missing doctor integration`);
}
for(const locale of ['es','ru','ko']){
 const i18n=await fs.readFile('src/i18n.ts','utf8');
 assert.ok(i18n.includes(`'Leak pointfile route'`)&&i18n.includes(`'Open Map Doctor'`));
}
console.log('PASS Map Doctor 2.0: pointfile parsing, bounds, fallback, compiler diagnostics, routes and UI hooks');
