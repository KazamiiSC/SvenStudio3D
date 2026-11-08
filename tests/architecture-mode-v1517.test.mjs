import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Run the real engine in Node without requiring Vite/Rollup native binaries.
// Import extensions remain those of the actual TypeScript project.
const ts=require('../node_modules/typescript/lib/typescript.js');
require.extensions['.ts']=(module,filename)=>{
  const source=readFileSync(filename,'utf8');
  const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowImportingTsExtensions:true,esModuleInterop:true}});
  module._compile(result.outputText,filename);
};
const {buildArchitectureLayout,validateArchitectureOutline,snapArchitecturePoint,replaceArchitectureLayout,removeArchitectureLayout,
  detachArchitectureLayout,triangulateArchitectureFloor,DEFAULT_LAYOUT_OPTIONS}=require('../src/engine/architectureMode.ts');
const {validateBrush}=require('../src/engine/exportMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const read=filename=>readFileSync(new URL('../'+filename,import.meta.url),'utf8');
const rectangle=[[0,0],[256,0],[256,192],[0,192]],L=[[0,0],[256,0],[256,96],[96,96],[96,256],[0,256]];
const options={...DEFAULT_LAYOUT_OPTIONS},texture='SV_BRICK01';
const base=()=>({version:1,target:'svengine',name:'Test Architecture Mode',world:{classname:'worldspawn'},wadNames:[],objects:[]});
const area=pts=>Math.abs(pts.reduce((sum,p,i)=>sum+p[0]*pts[(i+1)%pts.length][1]-p[1]*pts[(i+1)%pts.length][0],0))/2;

test('rooms compile into closed, convex, Valve 220-compatible brushes',()=>{
  for(const pts of [rectangle,L]){
    const {record,objects}=buildArchitectureLayout('room',pts,{...options,ceiling:true},texture);
    assert.equal(record.kind,'room');assert.equal(record.memberIds.length,objects.length);
    assert.equal(record.signatures.length,objects.length);
    assert.ok(objects.some(o=>o.name.startsWith('Floor')));
    assert.ok(objects.some(o=>o.name.startsWith('Ceiling')));
    assert.ok(objects.every(o=>o.kind==='brush'&&!o.entityId));
    assert.deepEqual(objects.flatMap(validateBrush),[]);
  }
});
test('open wall paths produce non-overlapping corner posts and spans',()=>{
  const {objects}=buildArchitectureLayout('walls',rectangle,options,texture);
  assert.equal(objects.length,rectangle.length+rectangle.length-1);
  assert.ok(objects.every(o=>o.primitive==='box'));
  assert.deepEqual(objects.flatMap(validateBrush),[]);
});
test('concave room floor is triangulated into convex prisms without area loss',()=>{
  for(const pts of [rectangle,L]){
    const tris=triangulateArchitectureFloor(pts);
    assert.equal(Math.round(tris.reduce((sum,t)=>sum+area(t),0)),Math.round(area(pts)));
  }
});
test('axis snapping makes consecutive wall points orthogonal',()=>{
  assert.deepEqual(snapArchitecturePoint([141,46],[32,0],16),[144,0]);
  assert.deepEqual(snapArchitecturePoint([40,171],[32,0],16),[32,176]);
});
test('invalid diagonal, short, self-crossing and unclosed layouts are rejected',()=>{
  assert.throws(()=>validateArchitectureOutline('room',[[0,0],[128,0],[96,160],[0,160]],options),/ortogonales/i);
  assert.throws(()=>validateArchitectureOutline('walls',[[0,0],[8,0]],options),/corto/i);
  assert.throws(()=>validateArchitectureOutline('room',[[0,0],[256,0],[256,192],[128,192],[128,-64],[64,-64],[64,128],[0,128]],options),/cruza|superpone/i);
  assert.throws(()=>validateArchitectureOutline('room',[[0,0],[128,0],[128,128]],options),/mínimo/i);
});
test('invalid dimensions or WAD names do not produce any brushes',()=>{
  assert.throws(()=>buildArchitectureLayout('room',rectangle,{...options,height:-4},texture));
  assert.throws(()=>buildArchitectureLayout('room',rectangle,options,'spaces invalid'));
  assert.throws(()=>buildArchitectureLayout('walls',rectangle,{...options,thickness:300},texture));
});
test('room options and editable outline survive project validation and reconstruction',()=>{
  const initial=buildArchitectureLayout('room',rectangle,options,texture);
  const project={...base(),objects:initial.objects,architectureLayouts:[initial.record]};
  assert.equal(validateProjectFile(project).architectureLayouts.length,1);
  const moved=rectangle.map(([x,y])=>[x+64,y+32]);
  const edited=replaceArchitectureLayout(project,initial.record.id,moved,{...options,height:320});
  assert.equal(edited.project.architectureLayouts[0].id,initial.record.id);
  assert.deepEqual(edited.project.architectureLayouts[0].points,moved);
  assert.deepEqual(edited.project.objects.flatMap(validateBrush),[]);
  assert.equal(validateProjectFile(edited.project).architectureLayouts[0].options.height,320);
});
test('manual modifications block regeneration without losing geometry',()=>{
  const generated=buildArchitectureLayout('room',rectangle,options,texture);
  const project={...base(),architectureLayouts:[generated.record],objects:generated.objects};
  const touched={...project,objects:project.objects.map((o,i)=>i===0?{...o,position:[o.position[0]+16,o.position[1],o.position[2]]}:o)};
  assert.throws(()=>replaceArchitectureLayout(touched,generated.record.id,rectangle,options),/manualmente/i);
  assert.throws(()=>removeArchitectureLayout(touched,generated.record.id),/manualmente/i);
  assert.equal(detachArchitectureLayout(touched,generated.record.id).objects.length,touched.objects.length);
});
test('deleting a tracked layout removes only that layout and its pieces',()=>{
  const room=buildArchitectureLayout('room',rectangle,options,texture);
  const others=buildArchitectureLayout('walls',[[320,0],[512,0]],options,texture);
  const project={...base(),objects:[...room.objects,...others.objects],architectureLayouts:[room.record,others.record]};
  const next=removeArchitectureLayout(project,room.record.id);
  assert.equal(next.architectureLayouts.length,1);
  assert.deepEqual(next.objects.map(o=>o.id),others.objects.map(o=>o.id));
});
test('the viewport connects one-shot draw and safe 3D corner edit without nested state loop',()=>{
  const view=read('src/components/Viewport.tsx'),mode=read('src/architectureModeState.ts'),panel=read('src/components/ArchitectureModePanel.tsx');
  assert.match(view,/function ArchitectureDrawingPlane/);assert.match(view,/function ArchitectureCornerHandles/);
  assert.match(view,/onPointerCancel/);assert.match(view,/edit\(record\.id,pending,record\.options\)/);
  assert.match(mode,/const EMPTY_POINTS/);assert.doesNotMatch(mode,/=>s\.points\|\|\[\]/);
  assert.match(panel,/Editar esquinas en el visor/);assert.match(panel,/ArchitectureDrawControls/);
});
test('the old generators remain accessible but Architecture Mode is the primary workflow',()=>{
  const shape=read('src/components/ShapePalette.tsx');
  assert.match(shape,/<ArchitectureModePanel/);assert.match(shape,/<ArchitectureBuilder\/>/);
  assert.match(shape,/const \[category,setCategory\]=useState<[^>]+>\('smart'\)/);
});
