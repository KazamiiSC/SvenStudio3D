/** v0.8.9.7 keyboard + mouse modifiers / session and UI regression checks. */
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-0897-'));
let count=0;
const test=(name,fn)=>{fn();count++;console.log('PASS',name)};
try{
  for(const file of ['src/engine/controls.ts','src/engine/transformModifiers.ts']){
    const dest=path.join(tmp,file.replace(/\.ts$/,'.js'));
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(tmp,'package.json'),JSON.stringify({type:'commonjs'}));
  const require=createRequire(path.join(tmp,'test.cjs'));
  const {DEFAULT_CONTROLS,readControls}=require('./src/engine/controls.js');
  const {transformGesture,modifierKeys,snapIncrement}=require('./src/engine/transformModifiers.js');
  const keys=(shift=false,ctrl=false,alt=false)=>({shift,ctrl,alt});
  test('no modifier preserves existing global-grid and rotation preferences',()=>{
    const move=transformGesture('translate',keys(),DEFAULT_CONTROLS,true,false);
    assert.equal(move.grid,true);assert.equal(move.fine,1);assert.equal(move.vertical,false);
    const rot=transformGesture('rotate',keys(),DEFAULT_CONTROLS,false,false);
    assert.equal(rot.degrees,0);assert.equal(rot.trackball,false);
  });
  test('Shift enables fine movement and disables global snap temporarily',()=>{
    const g=transformGesture('translate',keys(true),DEFAULT_CONTROLS,true,false);
    assert.equal(g.fine,.15);assert.equal(g.grid,false);
  });
  test('Ctrl forces grid, rotation degrees and scale steps even when default snap is off',()=>{
    assert.equal(transformGesture('translate',keys(false,true),DEFAULT_CONTROLS,false,false).grid,true);
    assert.equal(transformGesture('rotate',keys(false,true),DEFAULT_CONTROLS,false,false).degrees,15);
    assert.equal(transformGesture('scale',keys(false,true),DEFAULT_CONTROLS,false,false).factorStep,.1);
    assert.equal(snapIncrement(23,15),30);
    assert.ok(Math.abs(snapIncrement(1.26,.1)-1.3)<1e-9);
  });
  test('Ctrl takes precedence when combined with Shift; Shift remains a precision multiplier',()=>{
    const g=transformGesture('rotate',keys(true,true),DEFAULT_CONTROLS,true,false);
    assert.equal(g.degrees,15);assert.equal(g.fine,.15);assert.equal(g.grid,true);
  });
  test('Alt is vertical move, two-axis rotation or centered scaling; axis constraint takes precedence',()=>{
    assert.equal(transformGesture('translate',keys(false,false,true),DEFAULT_CONTROLS,false,false).vertical,true);
    assert.equal(transformGesture('rotate',keys(false,false,true),DEFAULT_CONTROLS,false,false).trackball,true);
    assert.equal(transformGesture('scale',keys(false,false,true),DEFAULT_CONTROLS,false,false).centered,true);
    assert.equal(transformGesture('rotate',keys(false,false,true),DEFAULT_CONTROLS,false,true).trackball,false);
    assert.equal(transformGesture('translate',keys(false,false,true),DEFAULT_CONTROLS,false,true).vertical,false);
  });
  test('modifier event decoding handles all combinations and release',()=>{
    assert.deepEqual(modifierKeys({shiftKey:true,ctrlKey:false,altKey:true}),keys(true,false,true));
    assert.deepEqual(modifierKeys({shiftKey:false,ctrlKey:false,altKey:false}),keys());
  });
  test('new numeric options are persistent and bounded without overriding other bindings',()=>{
    const saved={transformFineFactor:.04,transformRotationStep:30,transformScaleStep:.2,shortcuts:{scale:'KeyC',rotate:'KeyR'}};
    globalThis.localStorage={getItem:k=>k==='svenstudio-controls-v2'?JSON.stringify(saved):null,setItem(){}};
    const c=readControls();
    assert.equal(c.transformFineFactor,.04);assert.equal(c.transformRotationStep,30);assert.equal(c.transformScaleStep,.2);
    assert.equal(c.shortcuts.scale,'KeyC');assert.equal(c.shortcuts.move,'KeyG');
    globalThis.localStorage.getItem=()=>JSON.stringify({transformFineFactor:0,transformRotationStep:900,transformScaleStep:-1});
    const b=readControls();assert.equal(b.transformFineFactor,.02);assert.equal(b.transformRotationStep,90);assert.equal(b.transformScaleStep,.01);
  });
  const view=fs.readFileSync('src/components/Viewport.tsx','utf8');
  const app=fs.readFileSync('src/App.tsx','utf8');
  const css=fs.readFileSync('src/style.css','utf8');
  const i18n=fs.readFileSync('src/i18n.ts','utf8');
  test('modal responds to pointer and keyboard modifiers including keyup and blur',()=>{
    assert.ok(view.includes('preview({x:e.clientX,y:e.clientY},modifierKeys(e))'));
    assert.ok(view.includes("window.addEventListener('keyup',keyRelease)"));
    assert.ok(view.includes("window.removeEventListener('keyup',keyRelease)"));
    assert.ok(view.includes("window.addEventListener('blur',loseFocus)"));
    assert.ok(view.includes('gesture.trackball')&&view.includes('gesture.vertical')&&view.includes('gesture.centered'));
    assert.ok(view.includes("const scalePivot=gesture.centered?originalCenter:data.center"));
    assert.ok(view.includes('if(Object.keys(updates).length)transformSelection(updates)'));
    assert.ok(view.includes('if(!committed){'));
  });
  test('native gizmo receives Ctrl rotation/scale snap; translation uses relative delta',()=>{
    assert.ok(view.includes('c.setRotationSnap('));assert.ok(view.includes('c.setScaleSnap('));
    assert.ok(view.includes("if(drag.current.mode==='translate'&&(snapping||gizmoKeys.current.ctrl))"));
    assert.ok(!view.includes('c.setTranslationSnap('));
  });
  test('settings and live HUD are exposed to all four languages',()=>{
    assert.ok(app.includes("'transformFineFactor'"));assert.ok(app.includes("'transformRotationStep'"));
    assert.ok(app.includes("'transformScaleStep'"));assert.ok(view.includes('studio-modal-modifiers'));
    assert.ok(css.includes('.modal-transform-hud #studio-modal-modifiers'));
    for(const lang of ['es','ru','ko'])assert.ok(i18n.includes(`Object.assign(${lang},{\n  'Mouse transform modifiers'`));
  });
  console.log(`PASS v0.8.9.7: ${count} modifier and interface checks`);
} finally{fs.rmSync(tmp,{recursive:true,force:true})}
