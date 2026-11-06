/** v0.9.3 GoldSrc Valve 220 compatibility and R/C gizmo regression suite.
 * Runs without Chrome, Sven Co-op game assets, or the proprietary SDK. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import {createRequire} from 'node:module';
const cwd=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-goldsrc-093-'));
let passed=0;
function test(label,fn){fn();passed++;console.log('PASS',label)}
try{
  const files=['src/engine/controls.ts','src/engine/gizmoPointer.ts','src/engine/types.ts','src/engine/geometry.ts','src/engine/entityAppearance.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/architecture.ts','src/engine/transformUX.ts','src/engine/smartMerge.ts','src/engine/prefabs.ts','src/engine/gameplay.ts','src/engine/npc.ts','src/engine/sound.ts','src/engine/environment.ts','src/engine/skyEnclosure.ts','src/i18n.ts','src/engine/cinematic.ts','src/engine/customNpc.ts','src/engine/terrain.ts','src/store.ts'];
  for(const name of files){const out=path.join(tmp,name.replace(/\.ts$/i,'.js'));
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(tmp,'package.json'),' {"type":"commonjs"} ');
  fs.symlinkSync(path.join(cwd,'node_modules'),path.join(tmp,'node_modules'),'dir');
  const req=createRequire(path.join(tmp,'check.cjs'));
  const {exportMap,exportBrush,validateExportIntegrity}=req('./src/engine/exportMap.js');
  const {importMap,inspectMapImport}=req('./src/engine/importMap.js');
  const {createBrush,textureAxes}=req('./src/engine/geometry.js');
  const {useEditor}=req('./src/store.js');
  const player={id:'spawn',kind:'entity',classname:'info_player_start',name:'Spawn',position:[0,0,48],props:{angles:'0 90 0'},layer:'Gameplay'};
  const room=createBrush('box',[0,0,-16],[256,256,32],'Floor');
  const base=(objects)=>({version:1,target:'svengine',name:'map',objects,world:{classname:'worldspawn',skyname:'desert',message:'GoldSrc Compatibility'},wadNames:['halflife.wad']});
  test('R toggles rotate gizmo, second R selects without changing brush/history',()=>{
    useEditor.setState({project:base([room,player]),selected:room.id,selectedIds:[room.id],mode:'select',showTransformGizmo:false,modalTransform:null,history:[],future:[]});
    const baseline=JSON.stringify(useEditor.getState().project);
    useEditor.getState().toggleShortcutGizmo('rotate');
    assert.equal(useEditor.getState().mode,'rotate');assert.equal(useEditor.getState().showTransformGizmo,true);
    useEditor.getState().toggleShortcutGizmo('rotate');
    assert.equal(useEditor.getState().mode,'select');assert.equal(useEditor.getState().showTransformGizmo,false);
    assert.equal(JSON.stringify(useEditor.getState().project),baseline);assert.equal(useEditor.getState().history.length,0);
  });
  test('C toggles scale gizmo and R/C switch between gizmos safely',()=>{
    const baseline=JSON.stringify(useEditor.getState().project);
    useEditor.getState().toggleShortcutGizmo('scale');assert.equal(useEditor.getState().mode,'scale');
    useEditor.getState().toggleShortcutGizmo('rotate');assert.equal(useEditor.getState().mode,'rotate');
    useEditor.getState().toggleShortcutGizmo('scale');assert.equal(useEditor.getState().mode,'scale');
    useEditor.getState().toggleShortcutGizmo('scale');assert.equal(useEditor.getState().mode,'select');
    assert.equal(useEditor.getState().showTransformGizmo,false);
    assert.equal(JSON.stringify(useEditor.getState().project),baseline);
  });
  test('Keyboard routes G/R/C to persistent gizmos; Walk input excluded',()=>{
    const app=fs.readFileSync('src/App.tsx','utf8');
    assert.match(app,/if\(action==='move'\)useEditor\.getState\(\)\.toggleShortcutGizmo\('translate'\)/);
    assert.match(app,/action==='rotate'\)useEditor\.getState\(\)\.toggleShortcutGizmo\('rotate'\)/);
    assert.match(app,/action==='scale'\)useEditor\.getState\(\)\.toggleShortcutGizmo\('scale'\)/);
    assert.ok(app.indexOf('if(useEditor.getState().walkMode)')<app.indexOf('const action=shortcutAction(useEditor.getState().controls'));
  });
  test('Invalid brush entity reference stops export instead of silently discarding geometry',()=>{
    const orphan={...room,id:'lost',entityId:'missing',name:'Orphan wall'};
    assert.match(validateExportIntegrity(base([room,orphan,player])).join(' '),/missing.*prevent losing/i);
    assert.throws(()=>exportMap(base([room,orphan,player])),/Export blocked|prevent data loss/i);
  });
  test('Duplicate IDs and invalid brush planes fail closed before export',()=>{
    assert.throws(()=>exportMap(base([room,{...room},player])),/Duplicate object ID/);
    assert.throws(()=>exportBrush({...room,faces:[...room.faces.slice(0,4)]}),/Cannot export brush/);
    assert.throws(()=>exportMap(base([{...room,faces:room.faces.map(f=>({...f,uScale:0}))},player])),/invalid texture scale/);
  });
  test('Valve 220 texture axes/shifts/scales, SKY, water and masked material names roundtrip',()=>{
    const brush={...room,id:'uv-test',faces:room.faces.map((f,i)=>({...f,texture:i===0?'SKY':i===1?'!WATER':i===2?'{FENCE':'SV_TILE01',uAxis:[1,0,0],vAxis:[0,1,0],uShift:12.25,vShift:-6.75,uScale:.5,vScale:2,rotation:20}))};
    const exported=exportMap(base([brush,player]),['C:\\Sven Co-op\\svencoop\\halflife.wad']);
    assert.ok(exported.includes('!WATER')&&exported.includes('{FENCE')&&exported.includes(' SKY '));
    const reimport=importMap(exported,'uv.map');const after=reimport.objects.find(o=>o.kind==='brush');
    assert.ok(after);assert.equal(after.faces.length,brush.faces.length);
    for(const face of brush.faces){
      const similar=after.faces.find(f=>f.texture===face.texture);assert.ok(similar,face.texture);
      assert.equal(similar.uShift,face.uShift);assert.equal(similar.vShift,face.vShift);
      assert.equal(similar.uScale,face.uScale);assert.equal(similar.vScale,face.vScale);
      const original=textureAxes(brush.vertices,face),out=textureAxes(after.vertices,similar);
      for(const axis of ['u','v'])assert.ok(original[axis].every((x,i)=>Math.abs(x-out[axis][i])<.005),`axis ${axis} of ${face.texture}`);
    }
    assert.equal(reimport.world.wad,'C:\\Sven Co-op\\svencoop\\halflife.wad;');
  });
  test('Brush entity and point entity properties preserve target, targetname, spawnflags and light',()=>{
    const door={id:'door1',kind:'entity',classname:'func_door',name:'Door',position:[64,0,64],props:{targetname:'door_a',target:'relay_a',spawnflags:'64',speed:'125'}};
    const light={id:'light1',kind:'entity',classname:'light',name:'Light',position:[20,0,80],props:{_light:'255 240 210 400',targetname:'light_a'}};
    const brush={...room,id:'doorbrush',name:'Door panel',entityId:door.id};
    const mapped=importMap(exportMap(base([room,brush,door,light,player])),'gameplay.map');
    const importedDoor=mapped.objects.find(o=>o.kind==='entity'&&o.classname==='func_door');
    const importedLight=mapped.objects.find(o=>o.kind==='entity'&&o.classname==='light');
    assert.ok(importedDoor&&importedLight);
    for(const key of ['target','targetname','spawnflags','speed'])assert.equal(importedDoor.props[key],door.props[key]);
    assert.equal(importedLight.props._light,light.props._light);
    assert.equal(mapped.objects.filter(o=>o.kind==='brush'&&o.entityId===importedDoor.id).length,1);
  });
  test('Nine shipped MAP fixtures import/export without brush or entity count loss',()=>{
    let count=0;
    for(const name of fs.readdirSync('examples').filter(x=>x.endsWith('.map'))){
      const source=fs.readFileSync(path.join('examples',name),'utf8');
      const initial=inspectMapImport(source,name);assert.equal(initial.report.skippedBrushes,0,name);
      const exported=exportMap(initial.project);
      const recovered=inspectMapImport(exported,name);
      assert.equal(recovered.report.skippedBrushes,0,name);
      assert.equal(recovered.project.objects.filter(x=>x.kind==='brush').length,initial.project.objects.filter(x=>x.kind==='brush').length,name);
      assert.equal(recovered.project.objects.filter(x=>x.kind==='entity').length,initial.project.objects.filter(x=>x.kind==='entity').length,name);
      count++;
    }
    assert.ok(count>=9, 'All shipped MAP fixtures and new cinematic demo must roundtrip');
  });
  console.log(`PASS v0.9.3 GoldSrc compatibility + toggled gizmo: ${passed} test groups`);
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
