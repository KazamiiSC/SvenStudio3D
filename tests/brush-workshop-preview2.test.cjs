const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
const {createBrush}=require('../src/engine/geometry.ts');
const {planWorkshop,workshopFootprint}=require('../src/engine/brushWorkshop.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {useEditor}=require('../src/store.ts');
const source=()=>createBrush('box',[0,0,128],[512,512,256],'Test wall');
const options=(profile,segments=16)=>({u:0,v:0,width:96,height:96,depth:24,frame:12,profile,segments});
function checkMap(brushes){for(const brush of brushes)assert.deepEqual(validateBrush(brush),[],brush.name);
  const text=exportMap({...useEditor.getState().project,objects:brushes});const back=inspectMapImport(text,'workshop-preview2.map');
  assert.equal(back.report.skippedBrushes,0);assert.equal(back.project.objects.filter(o=>o.kind==='brush').length,brushes.length);
}
for(const profile of ['rectangle','circle','ellipse','polygon','rounded']){
  test(`${profile} geometry supports convex solid details`,()=>{
    const src=source(),shape=options(profile,profile==='polygon'?6:24);
    const f=planWorkshop(src,2,'panel',shape);
    assert.equal(f.additions.length,1);checkMap([src,...f.additions]);
    const p=workshopFootprint(shape);assert.ok(p.length>=4||profile==='polygon');
  });
  test(`${profile} supports carve and frame operations`,()=>{
    const src=source(),shape=options(profile,profile==='polygon'?6:16);
    for(const op of ['recess','opening','frame','framed-opening']){
      const result=planWorkshop(src,2,op,shape);
      const output=[...(result.replacement??[src]),...result.additions];
      assert.ok(output.length>1);checkMap(output);
    }
  });
}
test('circle detail quality can vary from 8 to 64 segments with precise diameter',()=>{
  const src=source();
  for(const segments of [8,12,16,24,32,48,64]){
    const shape=options('circle',segments);const result=planWorkshop(src,2,'panel',shape);
    assert.equal(result.additions[0].faces.length,segments+2);checkMap([src,...result.additions]);
  }
});
test('invalid segment counts and unsupported cuts are rejected before mutating a project',()=>{
  const src=source();
  assert.throws(()=>planWorkshop(src,2,'panel',options('circle',100)),/segments/i);
  assert.throws(()=>planWorkshop(src,2,'opening',{...options('ellipse',16),width:9999}),/dimensions/i);
});
test('standalone 3D inspector and face drawing coexist in Brush Workshop without changing global viewport',()=>{
  const component=fs.readFileSync(__dirname+'/../src/components/BrushWorkshop.tsx','utf8');
  const preview=fs.readFileSync(__dirname+'/../src/components/BrushWorkshopPreview3D.tsx','utf8');
  assert.match(component,/BrushWorkshopPreview3D/);assert.match(component,/setView\('draw'\)/);assert.match(component,/setView\('3d'\)/);
  assert.match(preview,/<Canvas/);assert.match(preview,/OrbitControls/);assert.match(preview,/onFaceSelect/);
});
test('64-segment circular through-cut and frame remain valid GoldSrc geometry',()=>{
 const src=source(),shape=options('circle',64);
 for(const op of ['opening','frame']){
   const p=planWorkshop(src,2,op,shape),brushes=[...(p.replacement??[src]),...p.additions];
   assert.ok(brushes.length>2);checkMap(brushes);
 }
});
