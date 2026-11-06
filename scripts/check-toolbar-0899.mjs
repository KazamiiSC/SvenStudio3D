/** v0.8.9.9: compact floating tool rail + Ghost/Gizmo + HUD migration smoke checks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const load=(file)=>{
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',js)(require,mod,mod.exports);return mod.exports;
};
const hud=load('src/hudLayout.ts');
const rail=fs.readFileSync('src/components/QuickToolRail.tsx','utf8');
const widget=fs.readFileSync('src/components/HudWidget.tsx','utf8');
const viewport=fs.readFileSync('src/components/Viewport.tsx','utf8');
const style=fs.readFileSync('src/style.css','utf8');
const store=fs.readFileSync('src/engine/terrain.ts','src/store.ts','utf8');
let checks=0;
const check=(name,fn)=>{fn();console.log('PASS',name);checks++};
check('gizmo and ghost live inside the one floating rail, not in separate HUD slot',()=>{
  assert.match(rail,/tool\(editor\.showTransformGizmo\?/);
  assert.match(rail,/editor\.setShowTransformGizmo\(!editor\.showTransformGizmo\)/);
  assert.match(rail,/tool\('Ghost mode'/);
  assert.match(rail,/editor\.toggleGhostHidden\(\)/);
  assert.match(store,/ghostHidden:false/);
  assert.match(viewport,/ghostHidden&&objects\.filter/);
  assert.ok(!viewport.includes('<HudWidget id="gizmo">'));
  assert.ok(!hud.HUD_IDS.includes('gizmo'));
});
check('legacy floating rail scale and old switch-side button are removed',()=>{
  for(const code of ['quick-size-trigger','setRailSize','railScale','svenstudio:float-rail-scale','Switch side']){
    assert.ok(!rail.includes(code),code);
  }
  assert.match(rail,/quick-rail-hud/);
  assert.match(style,/\.quick-rail-shell\.quick-rail-hud \.quick-rail/);
});
check('scrolling stays inside the rail and flyouts open outside the scroll clip',()=>{
  assert.match(style,/overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/);
  assert.match(style,/\.quick-rail-shell\.quick-rail-hud \.quick-flyout\{\s*position:absolute/);
  assert.match(rail,/quick-rail-inward/);
  assert.match(style,/quick-rail-shell\.quick-rail-inward \.quick-flyout/);
});
check('HUD uses layout-aware zoom instead of unscaled transform hit box',()=>{
  assert.match(widget,/style=\{\{zoom:config\.scale,opacity:config\.opacity\*globalOpacity\}\}/);
  assert.ok(!widget.includes('transform:`scale('));
});
check('old HUD save data with independent Gizmo is ignored safely',()=>{
  const base=hud.DEFAULT_HUD;
  assert.equal(hud.HUD_IDS.length,10);
  for(const id of hud.HUD_IDS) assert.ok(base[id]&&base[id].visible);
  assert.ok(!('gizmo' in hud.hudPreset('compact')));
  assert.ok(!('gizmo' in hud.hudPreset('minimal')));
  const old={...base,gizmo:{x:94,y:13,scale:1,opacity:1,visible:true}};
  const loaded=Object.fromEntries(hud.HUD_IDS.map(id=>[id,hud.normalizeHudItem(old[id],base[id])]));
  assert.deepEqual(Object.keys(loaded).sort(),[...hud.HUD_IDS].sort());
});
console.log(`PASS v0.8.9.9: ${checks} toolbar/HUD checks`);
