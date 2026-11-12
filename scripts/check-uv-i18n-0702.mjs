/** Camera UV gesture and new tool menu localization regression checks.
 * Does not require Vite or a platform-specific Rollup binary. */
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-uv-check-'));
try{
  const js=ts.transpileModule(fs.readFileSync('src/engine/controls.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const file=path.join(tmp,'controls.cjs');fs.writeFileSync(file,js);
  const {isUvDragGesture}=createRequire(file)(file);
  assert.equal(isUvDragGesture({button:0,altKey:true},true),true);
  assert.equal(isUvDragGesture({button:0,altKey:false},true),false);
  assert.equal(isUvDragGesture({button:1,altKey:true},true),false);
  assert.equal(isUvDragGesture({button:0,altKey:true},false),false);
  console.log('PASS camera lock gesture requires face mode + Alt + left mouse');
  const viewport=fs.readFileSync('src/components/Viewport.tsx','utf8');
  assert.match(viewport,/target\.addEventListener\('pointerdown',onPointer,true\)/);
  assert.match(viewport,/controls\.current\.enabled=false/);
  assert.match(viewport,/enabled=\{!walkMode&&!modal&&!drawMode&&!uvDragging\}/);
  assert.match(viewport,/setOrbitEnabled\(false\)/);
  assert.match(viewport,/finishTextureDrag\(true\)/);
  assert.match(viewport,/window\.addEventListener\('pointercancel',onRelease\)/);
  console.log('PASS viewport camera capture + texture drag isolation are wired');
  const i18n=fs.readFileSync('src/i18n.ts','utf8');
  let keys=[];
  for(const locale of ['es','ru','ko']){
    const find=`Object.assign(${locale},{`;
    // Read the v0.7.0 advanced UI bundle, not the most recent locale append.
    const start=i18n.indexOf(`${find}\n  \"Model / CSG\"`);
    assert.ok(start>=0,`${locale} bundle found`);
    const body=i18n.slice(start+`Object.assign(${locale},`.length);
    const end=body.indexOf(');');assert.ok(end>=0);
    const dict=JSON.parse(body.slice(0,end));
    if(!keys.length)keys=Object.keys(dict);
    assert.deepEqual(Object.keys(dict).sort(),keys.slice().sort());
    for(const key of ['Model / CSG','Union','Subtract','Intersect','Face UV: Alt + drag on the face. Undo: Ctrl + Z.','Bevel edge','Inset (taper)','Vault','Measure','Groups','Prefabs']){
      assert.equal(typeof dict[key],'string');if(key!=='Prefabs')assert.notEqual(dict[key],key,`${locale}: ${key}`);
    }
    console.log(`PASS ${locale} advanced UI: ${Object.keys(dict).length} labels`);
  }
  const quick=fs.readFileSync('src/components/QuickToolRail.tsx','utf8');
  const props=fs.readFileSync('src/components/Panels.tsx','utf8');
  assert.ok(quick.includes("tool('Model / CSG'") && quick.includes('t(name)'));
  assert.ok(quick.includes("{t('Extrude face')}") && quick.includes("{t('Inset (taper)')}"));
  assert.ok(props.includes("t('Advanced Building Studio')") && props.includes("t('Save prefab')"));
  console.log('PASS advanced UI uses translator rather than raw English labels');
}catch(error){console.error('FAIL 0.7.0.2',error);process.exitCode=1}
finally{fs.rmSync(tmp,{recursive:true,force:true});}
