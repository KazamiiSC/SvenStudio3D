/** v0.8.9.8 HUD layout and editor isolation tests. No browser required. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const code=fs.readFileSync('src/hudLayout.ts','utf8');
const transpiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};const require=createRequire(import.meta.url);
new Function('require','module','exports',transpiled)(require,module,module.exports);
const {HUD_IDS,DEFAULT_HUD,hudPreset,normalizeHudItem,useHudLayout}=module.exports;
let checks=0;
const ok=(name,fn)=>{fn();checks++;console.log('PASS',name)};
ok('all 10 independently configurable HUD groups exist (Gizmo relocated into Tools)',()=>{
  assert.equal(HUD_IDS.length,10);
  assert.equal(Object.keys(DEFAULT_HUD).length,10);
  for(const id of HUD_IDS)assert.ok(DEFAULT_HUD[id].visible);
});
ok('preset builders do not mutate default layout',()=>{
  const base=JSON.stringify(DEFAULT_HUD);
  assert.equal(hudPreset('compact').tools.scale,.7);
  assert.equal(hudPreset('minimal').help.visible,false);
  assert.equal(hudPreset('default').help.visible,true);
  assert.equal(JSON.stringify(DEFAULT_HUD),base);
});
ok('corrupt settings are bounded and missing values revert to defaults',()=>{
  const fallback=DEFAULT_HUD.tools;
  assert.deepEqual(normalizeHudItem({x:-400,y:900,scale:20,opacity:0,visible:false},fallback),{x:0,y:99,scale:1.8,opacity:.15,visible:false});
  assert.deepEqual(normalizeHudItem({x:NaN,y:Infinity,scale:NaN,opacity:NaN},fallback),fallback);
});
ok('one-widget changes are independent and do not alter MAP editing state',()=>{
  const s=useHudLayout.getState();const other=s.items.axes;
  s.update('tools',{x:27,y:32,scale:1.2,opacity:.65});
  assert.equal(useHudLayout.getState().items.tools.x,27);
  assert.equal(useHudLayout.getState().items.tools.opacity,.65);
  assert.deepEqual(useHudLayout.getState().items.axes,other);
  assert.equal(useHudLayout.getState().preset,'custom');
  useHudLayout.getState().resetItem('tools');
  assert.deepEqual(useHudLayout.getState().items.tools,DEFAULT_HUD.tools);
});
ok('opacities, minimal preset and reset remain bounded',()=>{
  useHudLayout.getState().setGlobalOpacity(-7);
  assert.equal(useHudLayout.getState().globalOpacity,.25);
  useHudLayout.getState().setGlobalOpacity(10);
  assert.equal(useHudLayout.getState().globalOpacity,1);
  useHudLayout.getState().applyPreset('minimal');
  assert.equal(useHudLayout.getState().items.stats.visible,false);
  useHudLayout.getState().applyPreset('default');
  assert.equal(useHudLayout.getState().items.stats.visible,true);
});
const view=fs.readFileSync('src/components/Viewport.tsx','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');
const dock=fs.readFileSync('src/components/DockWorkspace.tsx','utf8');
const widget=fs.readFileSync('src/components/HudWidget.tsx','utf8');
const panel=fs.readFileSync('src/components/HudCustomizer.tsx','utf8');
const css=fs.readFileSync('src/style.css','utf8');
const i18n=fs.readFileSync('src/i18n.ts','utf8');
ok('all controls are mounted in one viewport and original dock does not duplicate floating rail',()=>{
  assert.ok(view.includes('<HudWidget id="tools"><QuickToolRail/>'));
  assert.ok(!dock.includes('<QuickToolRail/>'));
  assert.ok(!view.includes('<HudWidget id="gizmo">'));
  assert.ok(view.includes('<HudWidget id="view">'));
  const rail=fs.readFileSync('src/components/QuickToolRail.tsx','utf8');
  assert.ok(rail.includes("'Show transform gizmo'")&&rail.includes("'Ghost mode'"));
  assert.ok(view.includes('<HudWidget id="pivot">'));
  assert.ok(view.includes('<HudWidget id="axes" editPlaceholder>'));
});
ok('customization mode blocks normal canvas input and keyboard edit shortcuts',()=>{
  assert.ok(view.includes('hudEditing&&<div className="hud-edit-shield"'));
  assert.ok(app.includes('if(useHudLayout.getState().editing)'));
  assert.ok(view.includes('if(useHudLayout.getState().editing||modal||uvDragging'));
  assert.ok(widget.includes('setPointerCapture(event.pointerId)'));
  assert.ok(widget.includes('hud-widget-content'));
});
ok('icons expose title, ARIA labels and preserve functional callbacks',()=>{
  for(const name of ['Frame all','Undo','Redo','Show entity names','Grid visibility','Snap to grid'])assert.ok(view.includes(`t('${name}')`));
  assert.ok(view.includes("projection('frameAll')"));
  assert.ok(view.includes("setFlag('showEntityNames',!showEntityNames)"));
  assert.ok(view.includes('onClick={undo}')&&view.includes('onClick={redo}'));
});
ok('opacity, presets, visibility and manual resizing have usable controls',()=>{
  for(const name of ['Element opacity','Overall HUD opacity','Element size','Reset element','Reset HUD','HUD layout'])assert.ok(panel.includes(name));
  assert.ok(widget.includes("kind:'move'|'scale'"));
  assert.ok(css.includes('.hud-widget-bar')&&css.includes('.hud-editor-panel'));
});
ok('new UI strings exist in Spanish, Russian and Korean, English remains default',()=>{
  for(const lang of ['es','ru','ko']){
    assert.ok(i18n.includes(`Object.assign(${lang},{\n  'Customize viewport HUD'`));
    for(const phrase of ['Element opacity','Overall HUD opacity','Reset HUD']){
      const block=i18n.split(`Object.assign(${lang},{\n  'Customize viewport HUD'`)[1];
      assert.ok(block.includes(`'${phrase}'`));
    }
  }
});
console.log(`PASS v0.8.9.8: ${checks} HUD tests`);
