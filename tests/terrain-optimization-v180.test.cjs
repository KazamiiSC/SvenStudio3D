const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {defaultTerrain,createTerrainBrushes,terrainBrushCount,terrainRecord}=require('../src/engine/terrain.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {demoProject}=require('../src/store.ts');
const check=(d,expected)=>{
 const brushes=createTerrainBrushes(d);assert.equal(brushes.length,expected);assert.equal(terrainBrushCount(d),expected);
 for(const b of brushes)assert.deepEqual(validateBrush(b),[]);
 const project={...demoProject(),objects:[...demoProject().objects,...brushes],terrainGroups:[terrainRecord(d,brushes)]};
 assert.equal(validateProjectFile(JSON.parse(JSON.stringify(project))).terrainGroups.length,1);
 const result=inspectMapImport(exportMap(project),'test.map');assert.equal(result.report.skippedBrushes,0);
};
const flat={...defaultTerrain(),optimized:true,resolution:16,heights:Array(289).fill(0)};check(flat,1);
const slope={...flat,heights:Array.from({length:289},(_,k)=>3*(k%17)+2*Math.floor(k/17))};check(slope,1);
const old={...flat,optimized:false};check(old,512);
const uneven={...flat,heights:Array.from({length:289},(_,k)=>k===17*8+8?60:0)};check(uneven,12);
console.log('terrain optimized: flat, slope, old, uneven PASS');
