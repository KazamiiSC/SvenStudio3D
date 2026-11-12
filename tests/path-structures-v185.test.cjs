const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {createPathStructureBrushes,validatePathStructure}=require('../src/engine/pathStructures.ts');
const {validateBrush}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {exportBrush}=require('../src/engine/exportMap.ts');
for(const kind of ['rail','fence','bridge']) for(const [name,points] of Object.entries({straight:[[0,0,0],[256,0,0]],bend:[[0,0,0],[150,0,0],[280,130,0]],slope:[[0,0,0],[160,50,64],[300,180,96]]})){
  const options={kind,points,width:96,height:96,wallThickness:8,texture:'SV_BRICK01',smooth:true,subdivisions:6,repeatSpacing:128};
  let brushes;
  try{brushes=createPathStructureBrushes(options,true)}catch(error){console.error('Failed',kind,name,String(error));throw error}
  assert.equal(validatePathStructure(options).length,0);
  assert.ok(brushes.length>1);
  for(const brush of brushes)assert.deepEqual(validateBrush(brush),[],brush.name);
  console.log(`${kind} ${name} ${brushes.length} brushes verified`);
}
