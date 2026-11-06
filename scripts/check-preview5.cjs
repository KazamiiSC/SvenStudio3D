const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,filename);
const {createBrush,createSizedPlaceableShape,transformedVertices,textureAxes,dot3,buildMeshGeometry}=require('../src/engine/geometry.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {importMap}=require('../src/engine/importMap.ts');
const {useEditor}=require('../src/store.ts');
const {translate,detectSystemLocale,LANGUAGES}=require('../src/i18n.ts');
const almost=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
let passed=0;function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){console.error('FAIL '+name,e);process.exitCode=1}}
const shapes=['wall','slab','beam','column','ramp','frame','room','roof','corner','platform','bridge','barrier','steps','doorframe','windowframe'];
test('15 new architectural presets are convex GoldSrc brushes',()=>{
 for(const kind of shapes){const bs=createSizedPlaceableShape(kind,[2048,-512,32],[192,144,120],'SV_TILE01');assert.ok(bs.length>=1,kind);for(const b of bs){assert.deepEqual(validateBrush(b),[],kind);assert.equal(b.faces[0].texture,'SV_TILE01')}}
});
test('all presets export and import without skipped brushes',()=>{
 let brushes=[];shapes.forEach((kind,i)=>brushes.push(...createSizedPlaceableShape(kind,[i*400,0,0],[160,120,96])));
 const project={version:1,name:'p5',world:{classname:'worldspawn'},wadNames:[],objects:brushes};
 const text=exportMap(project);const imported=importMap(text,'p5.map');
 assert.equal(imported.objects.filter(x=>x.kind==='brush').length,brushes.length);
});
test('valve 220 UV lock preserves texture projections on a rotated/transformed wall',()=>{
 const b=createBrush('box',[60,-20,84],[128,24,168]);b.faces.forEach(f=>{f.rotation=13;f.uShift=22;f.vShift=-11});
 const beforeVertices=transformedVertices(b),oldUV=b.faces.map(face=>{
  const axes=textureAxes(beforeVertices,face);
  return face.indices.map(i=>[dot3(beforeVertices[i],axes.u)+(face.uShift||0),dot3(beforeVertices[i],axes.v)+(face.vShift||0)]);
 });
 useEditor.setState({project:{version:1,name:'uvtest',world:{classname:'worldspawn'},wadNames:[],objects:[b]},selected:b.id,selectedIds:[b.id],history:[],future:[]});
 useEditor.getState().transformSelection({[b.id]:{position:[300,160,64],rotation:[35,55,92],scale:[1,1,1]}});
 let after=useEditor.getState().project.objects[0];assert.equal(after.kind,'brush');
 let afterVertices=transformedVertices(after);
 after.faces.forEach((face,fi)=>{const axes=textureAxes(afterVertices,face);face.indices.forEach((index,j)=>{
  const current=[dot3(afterVertices[index],axes.u)+(face.uShift||0),dot3(afterVertices[index],axes.v)+(face.vShift||0)];
  almost(current[0],oldUV[fi][j][0]);almost(current[1],oldUV[fi][j][1]);
 });assert.ok(face.uAxis&&face.vAxis);assert.equal(face.rotation,0)});
 assert.ok(exportMap(useEditor.getState().project).includes('SV_BRICK01'));
 useEditor.getState().undo();assert.equal(useEditor.getState().project.objects[0].faces[0].rotation,13);
 useEditor.getState().redo();assert.equal(useEditor.getState().project.objects[0].faces[0].rotation,0);
});
test('new locale recognition and professional Spanish UI labels',()=>{
 for(const key of ['zh-CN','zh-TW','pt-BR','pt-PT'])assert.ok(['zh','pt'].includes(detectSystemLocale([key])));
 for(const loc of ['zh','pt'])assert.ok(LANGUAGES.some(x=>x.id===loc));
 assert.equal(translate('es','Labels'),'Etiquetas');assert.equal(translate('es','Map Packager Studio'),'Empaquetador de mapas');
 assert.equal(translate('es','Ghost mode'),'Ver ocultos');assert.equal(translate('zh','Wall'),'墙');assert.equal(translate('pt','Door opening'),'Abertura de porta');
 assert.equal(translate('es','trigger_camera'),'trigger_camera');
});
test('visual construction palette includes drawing and wall-cutting tools',()=>{
 const palette=fs.readFileSync(path.join(__dirname,'../src/components/ShapePalette.tsx'),'utf8');const app=fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8');
 assert.ok(palette.includes('setDraw(!drawing)'));
 assert.ok(palette.includes("startOpening(kind,"));
 assert.ok(palette.includes('shape-palette-grid'));
 assert.ok(!app.includes('t(\'PRIMITIVES\')'));
});
test('foreground walls cannot intercept face scaling when pointer targets an arrow',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../src/components/Viewport.tsx'),'utf8');
 assert.ok(view.includes('selectedGizmoPointerHit=hit;'));
 assert.ok(view.includes('const tip=h.position.clone().addScaledVector(h.direction,35);'));
 assert.ok(view.includes('if(pointerOnSelectedGizmo(e))return;'));
});
console.log('Preview 5 tests '+passed+'/6 '+(process.exitCode?'FAILED':'PASS'));
