const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,filename);
const {createBrush,createSizedPlaceableShape,defaultShapeSize,shapeBounds,transformedVertices}=require('../src/engine/geometry.ts');
const THREE=require('three');
const {resizeFromFace,faceLocalBounds}=require('../src/engine/faceScale.ts');
const {exportMap,validateBrush}=require('../src/engine/exportMap.ts');
const {importMap}=require('../src/engine/importMap.ts');
const {demoProject,useEditor}=require('../src/store.ts');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}}
const tol=(a,b)=>assert.ok(Math.abs(a-b)<.01,`${a} != ${b}`);

test('ten shapes generate sized convex brushes at user-selected surface',()=>{
 for(const shape of ['box','wedge','cylinder','arch','vault','cone','pyramid','icosphere','stairs','pipe']){
  const brushes=createSizedPlaceableShape(shape,[320,-128,48],[240,160,96],'SV_CONCRET');
  assert.ok(brushes.length);for(const b of brushes)assert.deepEqual(validateBrush(b),[],`${shape} invalid`);
  const bounds=shapeBounds(brushes),size=bounds.getSize(new THREE.Vector3());
  tol(size.x,240);tol(size.y,160);tol(size.z,96);tol(bounds.min.z,48);tol(bounds.getCenter(new THREE.Vector3()).x,320);
  assert.equal(brushes[0].faces[0].texture,'SV_CONCRET');
 }
});
test('default dimensions remain same as legacy generation',()=>{
 for(const kind of ['box','stairs','pipe','arch'])for(const number of defaultShapeSize(kind))assert.ok(number>0);
});
test('opposite face remains fixed while dragging +X or -Z on rotated brushes',()=>{
 const brush=createBrush('box',[60,-30,100],[96,64,128]);brush.rotation=[10,5,30];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const {mins,maxs}=faceLocalBounds(brush),fixed=sign===1?mins[axis]:maxs[axis];
  const localBefore=[0,0,0];localBefore[axis]=fixed;
  const update=resizeFromFace(brush,axis,sign,32);
  const worldBefore=transformedVertices({...brush,vertices:[localBefore]})[0];
  const localAfter=[0,0,0];localAfter[axis]=fixed;
  const worldAfter=transformedVertices({...brush,vertices:[localAfter],position:update.position,scale:update.scale})[0];
  for(let k=0;k<3;k++)tol(worldBefore[k],worldAfter[k]);
 }
});
test('face scale never creates negative or degenerate extent',()=>{
 const b=createBrush('box',[0,0,32],[64,64,64]);
 const next=resizeFromFace(b,2,-1,-1000);
 assert.ok(next.scale[2]>0);tol(next.scale[2]*64,4);
});
test('sized shape exports and reimports through Valve 220',()=>{
 const source=demoProject();const extra=createSizedPlaceableShape('arch',[1024,0,40],[512,128,320]);
 const map=exportMap({...source,objects:[...source.objects,...extra]});
 const parsed=importMap(map,'shape_test.map');
 assert.equal(parsed.objects.filter(x=>x.kind==='brush').length,source.objects.filter(x=>x.kind==='brush').length+extra.length);
});
test('G toggles a persistent gizmo without mutating position or history',()=>{
 const b=createBrush('box',[5,10,15],[48,48,48]);
 useEditor.setState({project:{version:1,name:'keys',objects:[b],world:{classname:'worldspawn'},wadNames:[]},selected:b.id,selectedIds:[b.id],mode:'select',showTransformGizmo:false,history:[],future:[],drawMode:false});
 useEditor.getState().toggleShortcutGizmo('translate');assert.equal(useEditor.getState().mode,'translate');assert.equal(useEditor.getState().showTransformGizmo,true);
 assert.equal(useEditor.getState().modalTransform,null);assert.deepEqual(useEditor.getState().project.objects[0].position,[5,10,15]);assert.equal(useEditor.getState().history.length,0);
 useEditor.getState().toggleShortcutGizmo('translate');assert.equal(useEditor.getState().mode,'select');assert.equal(useEditor.getState().showTransformGizmo,false);
});
test('visibility list keeps shown brush and focus keeps hidden without history mutation',()=>{
 const b=createBrush('box',[10,20,30],[32,32,32]);b.hidden=true;
 useEditor.setState({project:{version:1,name:'hidden',objects:[b],world:{classname:'worldspawn'},wadNames:[]},visibilityListIds:[],history:[],selected:null,selectedIds:[]});
 useEditor.getState().focusHidden(b.id);assert.equal(useEditor.getState().project.objects[0].hidden,true);
 assert.equal(useEditor.getState().focusHiddenId,b.id);assert.equal(useEditor.getState().history.length,0);
 useEditor.getState().toggleVisibility(b.id);assert.equal(useEditor.getState().project.objects[0].hidden,false);assert.ok(useEditor.getState().visibilityListIds.includes(b.id));
});
console.log(`Preview 4 focused tests ${passed}/7${process.exitCode?' FAIL':' PASS'}`);
