const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict'),path=require('node:path');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJS},fileName:filename}).outputText,filename);
const {defaultTerrain,terrainBaseZ,terrainTopVertex,createTerrainBrushes,createTerrainPreviewShell,validateTerrainDraft,terrainRecord}=require('../src/engine/terrain.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {demoProject,useEditor}=require('../src/store.ts');
let passed=0;
function test(label,fn){try{fn();console.log('PASS',label);passed++}catch(e){process.exitCode=1;console.error('FAIL',label,e)}}
const local=(v,o)=>JSON.stringify([+(v[0]-o[0]).toFixed(2),+(v[2]-o[2]).toFixed(2),+(o[1]-v[1]).toFixed(2)]);
const pts=a=>Array.from({length:a.length/3},(_,i)=>JSON.stringify(a.slice(i*3,i*3+3)));
test('Default 96-unit depth and previous terrain without baseDepth have unchanged bottom',()=>{
 for(const minimum of [0,-20,-64,-150,-512]){
  const d={...defaultTerrain([200,300,64]),heights:Array(81).fill(16)};d.heights[0]=minimum;
  const old=64+Math.min(-96,minimum-64);
  assert.equal(terrainBaseZ(d),old);
  delete d.baseDepth;
  assert.equal(terrainBaseZ(d),old);
 }
});
test('Adjustable depth moves solid bottom but never clips a valley',()=>{
 const d=defaultTerrain([640,-320,48]);
 assert.equal(terrainBaseZ(d),-48);
 assert.equal(terrainBaseZ({...d,baseDepth:256}),-208);
 const valley={...d,heights:d.heights.map((_,i)=>i===1?-300:0)};
 assert.equal(terrainBaseZ({...valley,baseDepth:64}),48-364);
 assert.equal(terrainBaseZ({...valley,baseDepth:256}),48-364);
});
test('Preview draws top, four boundary sides and underside, with same extrema as GoldSrc brushes',()=>{
 for(const n of [4,8,12,16]){
  const d={...defaultTerrain([256,512,80]),resolution:n,width:512,depth:384,baseDepth:192,
    heights:Array.from({length:(n+1)**2},(_,i)=>i%5===0?-100:i%7===0?120:0)};
  const shell=createTerrainPreviewShell(d),brushes=createTerrainBrushes(d);
  assert.equal(brushes.length,2*n*n);
  assert.equal(shell.topPositions.length,2*n*n*3*3);
  assert.equal(shell.basePositions.length,(2*n*n+8*n)*3*3);
  assert.equal(shell.topUvs.length,shell.topPositions.length/3*2);
  assert.equal(shell.baseUvs.length,shell.basePositions.length/3*2);
  assert.equal(shell.bottomZ,terrainBaseZ(d));
  const exportedTop=new Set(brushes.flatMap(b=>b.vertices.slice(0,3).map(v=>local(v,d.origin))));
  const previewTop=new Set(pts(shell.topPositions));
  assert.deepEqual(previewTop,exportedTop);
  const btm=shell.basePositions.filter((_,i)=>i%3===1);
  assert.ok(btm.some(z=>z===shell.bottomZ-d.origin[2]));
  const minY=Math.min(...brushes.flatMap(b=>b.vertices.map(v=>v[2])))-d.origin[2];
  assert.equal(Math.min(...btm),minY);
  for(const b of brushes)assert.deepEqual(validateBrush(b),[]);
 }
});
test('Invalid depths are rejected in both terrain builder and project validation',()=>{
 for(const baseDepth of [-1,0,63,1025,Infinity,NaN]){
  const draft={...defaultTerrain(),baseDepth};
  assert.ok(validateTerrainDraft(draft).length);
  assert.throws(()=>createTerrainBrushes(draft));
  assert.throws(()=>createTerrainPreviewShell(draft));
 }
 const d=defaultTerrain(),brushes=createTerrainBrushes(d);
 const project={...demoProject(),objects:[...demoProject().objects,...brushes],terrainGroups:[terrainRecord(d,brushes)]};
 for(const invalid of [null,'100',Infinity,2000]){
  const wrong=structuredClone(project);wrong.terrainGroups[0].baseDepth=invalid;
  assert.throws(()=>validateProjectFile(wrong));
 }
});
test('Old and new saved projects and MAP export/import roundtrip are valid',()=>{
 const d={...defaultTerrain([600,700,80]),baseDepth:352},brushes=createTerrainBrushes(d);
 const project={...demoProject(),objects:[...demoProject().objects,...brushes],terrainGroups:[terrainRecord(d,brushes)]};
 assert.equal(validateProjectFile(JSON.parse(JSON.stringify(project))).terrainGroups[0].baseDepth,352);
 const legacy=structuredClone(project);delete legacy.terrainGroups[0].baseDepth;
 assert.ok(validateProjectFile(legacy).terrainGroups[0]);
 const map=exportMap(project),imported=inspectMapImport(map,'p3_export.map');
 assert.equal(imported.report.skippedBrushes,0);
 assert.equal(imported.project.objects.filter(x=>x.kind==='brush').length,project.objects.filter(x=>x.kind==='brush').length);
});
test('Depth is persisted and Undo/Redo works without replacing other editor objects',()=>{
 const source=demoProject();useEditor.getState().loadProject(source);
 const d={...defaultTerrain([300,400,100]),baseDepth:320};
 useEditor.getState().applyTerrain(d);
 let state=useEditor.getState();assert.equal(state.project.terrainGroups[0].baseDepth,320);
 assert.equal(state.project.objects.length,source.objects.length+128);
 assert.equal(state.project.objects.filter(x=>x.kind==='entity').length,source.objects.filter(x=>x.kind==='entity').length);
 state.undo();assert.equal(useEditor.getState().project.objects.length,source.objects.length);
 state.redo();assert.equal(useEditor.getState().project.terrainGroups[0].baseDepth,320);
});
test('Studio has solid shell default, toggle, depth control, four translations and validation safe-guard',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../src/components/TerrainShapeStudio.tsx'),'utf8');
 const eng=fs.readFileSync(path.join(__dirname,'../src/engine/terrain.ts'),'utf8');
 const dict=fs.readFileSync(path.join(__dirname,'../src/i18n.ts'),'utf8');
 assert.match(ui,/useState\(true\).*showBase|\[showBase,setShowBase\]=useState\(true\)/);
 assert.match(ui,/createTerrainPreviewShell\(draft\)/);
 assert.match(ui,/try\{shell=createTerrainPreviewShell\(draft\)\}catch/);
 assert.match(ui,/raycast=\{\(\)=>null\}/);
 assert.match(ui,/Base depth \(units\)/);
 assert.match(ui,/textureAssets=useEditor/);
 for(const lang of ['es','ru','ko'])assert.match(dict,new RegExp(`Object.assign\\(${lang},\\{[\\s\\S]*?'Solid terrain \\(base visible\\)'`));
 assert.match(eng,/terrainBaseZ\(d\)/);
});
console.log(`Terrain Preview 3 tests ${passed}/7 ${process.exitCode?'FAIL':'PASS'}`);
