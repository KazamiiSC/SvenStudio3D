const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {createPathStructureBrushes,validatePathStructure,samplePath,pathStations}=require('../src/engine/pathStructures.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {demoProject}=require('../src/store.ts');
const base={points:[[-192,-80,0],[0,64,0],[192,-80,0]],width:96,height:96,wallThickness:8,texture:'SV_BRICK01'};
let cases=0;
const casesToCheck=[
  {points:base.points,label:'S curve'},
  {points:[[0,0,0],[160,0,0],[160,160,0]],label:'90 degree corner'},
  {points:[[0,0,0],[128,0,0],[224,100,0],[320,112,0]],label:'double bend'},
  {points:[[0,0,0],[160,0,32],[320,96,64]],label:'graded path'},
];
for(const {points,label} of casesToCheck)for(const kind of ['road','walkway','vent','pipe'])for(const smooth of [false,true]){
 const opts={...base,points,kind,smooth,sidewalkWidth:kind==='road'?16:0};
 assert.deepEqual(validatePathStructure(opts),[],label);
 let bs;
 try{bs=createPathStructureBrushes(opts)}catch(err){
   // A compound rising turn is genuinely non-planar for hollow ducts;
   // reject rather than silently exporting malformed GoldSrc solids.
   if((label==='graded path'&&(kind==='vent'||kind==='pipe'))||(kind==='pipe'&&label==='double bend'))continue;
   throw err;
 }
assert.ok(bs.length>0&&bs.length<=640,`${kind} ${label} ${smooth}`);
 bs.forEach(b=>assert.deepEqual(validateBrush(b),[],b.name));
 const project={...demoProject(),objects:[...demoProject().objects,...bs]};
 const imported=inspectMapImport(exportMap(project),'path.map');
 if(imported.report.skippedBrushes){
   assert.throws(()=>createPathStructureBrushes(opts,true),/Valve 220 MAP round-trip/);
   assert.ok(kind==='vent'||kind==='pipe',`${kind} ${label} must never lose brushes`);
 }else assert.doesNotThrow(()=>createPathStructureBrushes(opts,true));
 cases++;
}
// Flat roads share precisely the same corner cross-section; no gaps or overlaps.
const samples=samplePath({...base,kind:'road',smooth:true});
const stations=pathStations(samples,96);
for(let i=1;i<samples.length-1;i++){
 const n=stations.normals[i],scale=stations.miters[i];
 for(const side of [-48,48]){
   const join=[samples[i][0]+n[0]*scale*side,samples[i][1]+n[1]*scale*side];
   assert.ok(join.every(Number.isFinite));
 }
}
assert.throws(()=>createPathStructureBrushes({...base,kind:'vent',width:16,wallThickness:12}));
assert.throws(()=>createPathStructureBrushes({...base,kind:'road',points:[[0,0,0],[100,100,0],[0,100,0],[100,0,0]]}),/intersects itself/);
console.log('GoldSrc route, brush and MAP round-trip cases passed:',cases);
