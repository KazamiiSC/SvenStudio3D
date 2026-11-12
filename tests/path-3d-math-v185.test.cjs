const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {pathPointToPreview,movePathPointOnAxis}=require('../src/engine/path3DMath.ts');
assert.deepEqual(pathPointToPreview([32,64,96]),[32,96,-64]);
assert.deepEqual(movePathPointOnAxis([32,64,96],[10,25,-18],'xy'),[40,80,96]);
assert.deepEqual(movePathPointOnAxis([32,64,96],[10,25,-18],'x'),[40,64,96]);
assert.deepEqual(movePathPointOnAxis([32,64,96],[10,25,-18],'y'),[32,80,96]);
assert.deepEqual(movePathPointOnAxis([32,64,96],[10,25,-18],'z'),[32,64,120]);
console.log('3D map coordinate conversion, 4 edit constraints, snap and Z motion: PASS');
