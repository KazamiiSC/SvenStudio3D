/** Professional Mapping Tools v0.8.0 checks without Windows compilers/Vite. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'svenstudio-080-'));
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name)}
try{
  const files=[
    'engine/types.ts','engine/entityAppearance.ts','engine/controls.ts','engine/geometry.ts',
    'engine/exportMap.ts','engine/importMap.ts','engine/fgd.ts','engine/modeling.ts',
    'engine/advancedModeling.ts','engine/prefabs.ts','engine/architecture.ts','engine/smartMerge.ts','engine/gameplay.ts','engine/npc.ts',
    'engine/sound.ts','engine/environment.ts','engine/skyEnclosure.ts','engine/mapDiagnostics.ts','i18n.ts','store.ts'
  ];
  for(const file of files){const out=path.join(dir,file.replace(/\.ts$/,'.js'));
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(path.join(root,'src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(dir,'package.json'),'{"type":"commonjs"}');
  fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
  const require=createRequire(path.join(dir,'test.cjs'));
  const {createBrush,buildMeshGeometry,textureAxes,textureSettings}=require('./engine/geometry.js');
  const {exportMap,validateBrush}=require('./engine/exportMap.js');
  const {analyzeMap}=require('./engine/mapDiagnostics.js');
  const {useEditor}=require('./store.js');
  const brush=createBrush('box',[0,0,0]);
  const spawn={id:'spawn',kind:'entity',name:'info_player_start',classname:'info_player_start',position:[0,0,48],props:{}};
  const trigger={id:'trigger',kind:'entity',name:'trigger_once',classname:'trigger_once',position:[0,0,64],props:{target:'missing_lamp'}};
  const project=(objects)=>({version:1,target:'svengine',name:'test',objects,world:{classname:'worldspawn',skyname:'desert'},wadNames:['svstudio.wad']});
  const fresh=(objects)=>useEditor.setState({project:project(objects),selected:null,selectedIds:[],selectedFace:null,geometryMode:'object',faceMode:false,history:[],future:[],textureDragSnapshot:null,faceClipboard:null,snap:16});
  check('MAP diagnostics detect missing targets and WAD references without blocking source map',()=>{
    const report=analyzeMap(project([brush,spawn,trigger]),[{name:'TEST',wad:'test.wad',width:128,height:128,dataUrl:'test'}]);
    assert.ok(report.issues.some(x=>x.code==='MISSING_TARGET'&&x.objectId===trigger.id));
    assert.ok(report.issues.some(x=>x.code==='TEXTURE_NOT_IMPORTED'));
    assert.equal(report.issues.filter(x=>x.severity==='error').length,0);
    assert.ok(exportMap(project([brush,spawn,trigger])).includes('"skyname" "desert"'));
  });
  check('MAP diagnostics catch invalid brush geometry and absent player spawn',()=>{
    const broken=structuredClone(brush);broken.faces[0].indices=[0,0,0];
    const issues=analyzeMap(project([broken])).issues;
    assert.ok(issues.some(x=>x.code==='BRUSH_INVALID'));
    assert.ok(issues.some(x=>x.code==='NO_SPAWN'));
  });
  check('Valve 220 UV rotation writes explicit planar axes and changes visual UVs',()=>{
    const original=structuredClone(brush),rotated=structuredClone(brush);
    rotated.faces[0].rotation=90;
    const g0=buildMeshGeometry(original),g90=buildMeshGeometry(rotated);
    const uv0=Array.from(g0.attributes.uv.array),uv90=Array.from(g90.attributes.uv.array);
    assert.notDeepEqual(uv0,uv90);
    const before=exportMap(project([original,spawn])),after=exportMap(project([rotated,spawn]));
    assert.notEqual(before,after);
    assert.match(after,/\] \[ .* \] 0 1 1/);
    assert.deepEqual(validateBrush(rotated),[]);
    g0.dispose();g90.dispose();
  });
  check('copy, paste and world-align UV keep one undo step each',()=>{
    const a=structuredClone(brush);a.faces[1].texture='BRICK';a.faces[1].uShift=22;a.faces[1].rotation=45;
    fresh([a]);const state=()=>useEditor.getState();
    state().copyFaceSettings(a.id,1);assert.equal(state().faceClipboard.texture,'BRICK');
    state().pasteFaceSettings(a.id,0);
    assert.equal(state().project.objects[0].faces[0].uShift,22);
    assert.equal(state().project.objects[0].faces[0].rotation,45);
    state().alignFaceTexture(a.id,0);assert.equal(state().project.objects[0].faces[0].uShift,0);
    state().undo();assert.equal(state().project.objects[0].faces[0].uShift,22);
    assert.equal(textureSettings(a.faces[1]).texture,'BRICK');
  });
  check('mouse UV rotate/scale isolates original snapshot and commits one undo entry',()=>{
    const a=createBrush('box',[0,0,0]);fresh([a]);const state=()=>useEditor.getState();
    state().beginTextureDrag(a.id,0);
    state().updateTextureTransform(a.id,0,'rotate',80,0);
    assert.equal(state().project.objects[0].faces[0].rotation,48);
    state().finishTextureDrag(true);
    assert.equal(state().history.length,1);
    state().undo();assert.equal(state().project.objects[0].faces[0].rotation,undefined);
    state().beginTextureDrag(a.id,0);state().updateTextureTransform(a.id,0,'scale',80,60);
    assert.ok(state().project.objects[0].faces[0].uScale>1);
    assert.ok(state().project.objects[0].faces[0].vScale<1);
    state().finishTextureDrag(false);
    assert.equal(state().project.objects[0].faces[0].uScale,undefined);
  });
  check('grid snap handles multiple selected objects and undo',()=>{
    const a=createBrush('box',[11,27,35]);const b=createBrush('box',[54,25,17]);fresh([a,b]);const state=()=>useEditor.getState();
    state().selectObject(a.id,false);state().selectObject(b.id,true);state().snapSelectionToGrid();
    assert.deepEqual(state().project.objects[0].position,[16,32,32]);
    assert.deepEqual(state().project.objects[1].position,[48,32,16]);
    state().undo();assert.deepEqual(state().project.objects[0].position,[11,27,35]);
  });
  check('v0.8 UI tools and all translations wired',()=>{
    const app=fs.readFileSync('src/App.tsx','utf8');
    const viewport=fs.readFileSync('src/components/Viewport.tsx','utf8');
    const light=fs.readFileSync('src/components/LightingStudio.tsx','utf8');
    const quick=fs.readFileSync('src/components/QuickToolRail.tsx','utf8');
    const doctor=fs.readFileSync('src/components/MapDoctor.tsx','utf8');
    const panel=fs.readFileSync('src/components/Panels.tsx','utf8');
    const {translate}=require('./i18n.js');
    for(const locale of ['es','ru','ko'])for(const label of ['Map Doctor','Preview shadows (selected light)','Show point light radius','Copy face material','Paste face material','Align UV to world','Snap selection to grid']){
      assert.notEqual(translate(locale,label),label,`${locale}: ${label}`);
    }
    assert.ok(app.includes("setDialog('doctor')")&&app.includes("dialog==='doctor'"));
    assert.ok(quick.includes("tool('Map Doctor'")&&quick.includes('snapSelectionToGrid'));
    assert.ok(light.includes('setPreviewShadows')&&light.includes('setShowLightRanges'));
    assert.ok(viewport.includes('castShadow={shadows')&&viewport.includes('updateTextureTransform'));
    assert.ok(doctor.includes('localizeIssue')&&panel.includes("t('Copy face material')"));
  });
  console.log(`PASS v0.8.0: ${passed} targeted checks.`);
}catch(error){console.error('FAIL v0.8.0',error);process.exitCode=1}
finally{delete globalThis.localStorage;fs.rmSync(dir,{recursive:true,force:true})}
