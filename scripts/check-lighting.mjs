// v0.6.4: Svengine keyvalues, placement mode, fog validation, sky and .map round-trip.
import ts from 'typescript';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'svstudio-lighting-'));
try {
 const files=['engine/types.ts','engine/environment.ts','engine/skyEnclosure.ts','engine/architecture.ts','engine/smartMerge.ts','engine/geometry.ts','engine/exportMap.ts','engine/importMap.ts','engine/sound.ts','engine/entityAppearance.ts','engine/controls.ts','engine/fgd.ts','engine/modeling.ts','engine/advancedModeling.ts','engine/prefabs.ts','engine/gameplay.ts','engine/npc.ts','i18n.ts','store.ts'];
 for(const file of files){const out=path.join(root,file.replace('.ts','.js'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(path.resolve('src',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)}
 fs.writeFileSync(path.join(root,'package.json'),'{'+'"type":"commonjs"'+'}');fs.symlinkSync(path.resolve('node_modules'),path.join(root,'node_modules'));
 const require=createRequire(path.join(root,'test.cjs'));
 const {makeEnvironment,validateEnvironment,LIGHT_PRESETS,parseLight,lightString,hexRgb}=require('./engine/environment.js');
 const {demoProject,useEditor}=require('./store.js');
 const {exportMap}=require('./engine/exportMap.js');const {importMap}=require('./engine/importMap.js');
 assert.deepEqual(parseLight('240 180 60 300'),{rgb:[240,180,60],brightness:300});
 assert.equal(lightString(hexRgb('#ff8040'),350),'255 128 64 350');
 const point=makeEnvironment('light',[12,0,120],{_light:'255 80 60 330'});
 const spot=makeEnvironment('light_spot',[0,0,144],{_cone:'24',_cone2:'45',pitch:'-30'});
 const sun=makeEnvironment('light_environment',[0,0,200],{...{_light:LIGHT_PRESETS.sunset.light,_diffuse_light:LIGHT_PRESETS.sunset.ambient}});
 const fog=makeEnvironment('env_fog',[0,0,128],{iuser2:'100',iuser3:'900',rendercolor:'120 125 155'});
 const sky=makeEnvironment('trigger_changesky',[0,0,64],{skyname:'desert',targetname:'evening_sky'});
 assert.equal(validateEnvironment([point,spot,sun,fog,sky]).length,0);
 assert(validateEnvironment([{...fog,props:{...fog.props,iuser3:'50'}}]).some(x=>x.severity==='error'));
 assert(validateEnvironment([{...spot,props:{...spot.props,_cone:'80',_cone2:'15'}}]).some(x=>x.severity==='error'));
 const p=demoProject();p.objects.push(point,spot,sun,fog,sky);
 const txt=exportMap(p),loaded=importMap(txt);
 for(const e of [point,spot,sun,fog,sky]){
  const found=loaded.objects.find(o=>o.kind==='entity'&&o.classname===e.classname&&o.props._light===e.props._light);
  assert(found,`Lost ${e.classname}`);
  for(const [key,val] of Object.entries(e.props))assert.equal(found.props[key],val,`${e.classname}.${key}`);
 }
 useEditor.setState({project:demoProject(),selected:null,selectedIds:[],history:[],future:[],environmentPlacement:null});
 const prevCount=useEditor.getState().project.objects.length;
 useEditor.getState().startEnvironmentPlacement('light_spot',{_light:'255 80 60 480',_cone:'22',_cone2:'40'});
 assert.equal(useEditor.getState().project.objects.length,prevCount);
 useEditor.getState().placePendingEnvironment([128,64,96]);
 assert.equal(useEditor.getState().project.objects.length,prevCount+1);
 assert.equal(useEditor.getState().environmentPlacement,null);
 const placed=useEditor.getState().project.objects.at(-1);
 assert.equal(placed.props._light,'255 80 60 480');assert.equal(placed.props._cone2,'40');
 useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,prevCount);
 useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,prevCount+1);
 useEditor.getState().changeWorld('skyname','cliff');assert.equal(useEditor.getState().project.world.skyname,'cliff');
 useEditor.getState().undo();assert.equal(useEditor.getState().project.world.skyname,'desert');
 console.log('PASS v0.6.4: native lights, spot/fog/sky validation, map roundtrip, placement options, undo/redo, skyname.');
} finally {fs.rmSync(root,{recursive:true,force:true})}
